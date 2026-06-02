create or replace function public.extension_normalize_support_message_target(p_target jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_kind text := lower(trim(coalesce(p_target->>'kind', p_target->>'type', '')));
  v_url text;
begin
  if p_target is null or jsonb_typeof(p_target) <> 'object' then
    return 'null'::jsonb;
  end if;

  if v_kind <> 'url' then
    return 'null'::jsonb;
  end if;

  v_url := nullif(trim(coalesce(p_target->>'url', '')), '');
  if v_url is null then
    return 'null'::jsonb;
  end if;

  return jsonb_build_object(
    'kind', 'url',
    'url', v_url
  );
end;
$$;

revoke all on function public.extension_normalize_support_message_target(jsonb) from public, anon, authenticated;

create or replace function public.extension_cleanup_support_reminder_state(p_state jsonb)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  with base as (
    select case
      when p_state is not null and jsonb_typeof(p_state) = 'object' then p_state
      else '{}'::jsonb
    end as state
  ),
  reminders as (
    select coalesce(
      jsonb_object_agg(
        entry.key,
        case
          when jsonb_typeof(entry.value) = 'object' then jsonb_set(
            entry.value,
            '{messageTarget}',
            public.extension_normalize_support_message_target(entry.value->'messageTarget'),
            true
          )
          else entry.value
        end
      ) filter (where entry.key is not null),
      '{}'::jsonb
    ) as value
    from base
    left join lateral jsonb_each(
      case
        when jsonb_typeof(base.state->'reminders') = 'object' then base.state->'reminders'
        else '{}'::jsonb
      end
    ) as entry(key, value) on true
  ),
  archive as (
    select coalesce(
      jsonb_object_agg(
        entry.key,
        case
          when jsonb_typeof(entry.value) = 'object' then jsonb_set(
            entry.value,
            '{messageTarget}',
            public.extension_normalize_support_message_target(entry.value->'messageTarget'),
            true
          )
          else entry.value
        end
      ) filter (where entry.key is not null),
      '{}'::jsonb
    ) as value
    from base
    left join lateral jsonb_each(
      case
        when jsonb_typeof(base.state->'archive') = 'object' then base.state->'archive'
        else '{}'::jsonb
      end
    ) as entry(key, value) on true
  )
  select jsonb_set(
    jsonb_set(base.state, '{reminders}', reminders.value, true),
    '{archive}',
    archive.value,
    true
  )
  from base, reminders, archive;
$$;

revoke all on function public.extension_cleanup_support_reminder_state(jsonb) from public, anon, authenticated;

insert into public.extension_sync_state (user_id, schema_version, revision)
select distinct kv.user_id, 2, 0
from public.extension_user_kv kv
where kv.key = 'support_reminders_state_v1'
  and kv.deleted_at is null
on conflict (user_id) do nothing;

with affected as (
  select
    kv.user_id,
    public.extension_cleanup_support_reminder_state(kv.value) as cleaned_value,
    coalesce(sync.revision, 0) + 1 as next_revision
  from public.extension_user_kv kv
  join public.extension_sync_state sync
    on sync.user_id = kv.user_id
  where kv.key = 'support_reminders_state_v1'
    and kv.deleted_at is null
    and kv.value is distinct from public.extension_cleanup_support_reminder_state(kv.value)
),
updated_kv as (
  update public.extension_user_kv kv
  set value = affected.cleaned_value,
      revision = affected.next_revision,
      updated_at = now(),
      updated_by_device_id = 'server:migration:remove-legacy-support-msg',
      deleted_at = null
  from affected
  where kv.user_id = affected.user_id
    and kv.key = 'support_reminders_state_v1'
  returning affected.user_id, affected.next_revision
)
update public.extension_sync_state sync
set revision = updated_kv.next_revision,
    updated_at = now(),
    updated_by_device_id = 'server:migration:remove-legacy-support-msg'
from updated_kv
where sync.user_id = updated_kv.user_id;
