-- One durable watermark per device; legacy receipts are retained only for migration.
create schema if not exists extension_sync_private;
revoke all on schema extension_sync_private from public;
grant usage on schema extension_sync_private to authenticated;
create table extension_sync_private.device_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 device_id text not null, last_sequence bigint not null default 0,
 applied_revision bigint not null default 0, updated_at timestamptz not null default now(),
 primary key(user_id,device_id)
);
create table extension_sync_private.legacy_receipts (
 user_id uuid not null references auth.users(id) on delete cascade,
 mutation_hash bytea not null, status text not null,
 applied_revision bigint, error text, created_at timestamptz not null,
 primary key(user_id,mutation_hash)
);
alter table extension_sync_private.device_progress enable row level security;
alter table extension_sync_private.legacy_receipts enable row level security;
revoke all on all tables in schema extension_sync_private from public, anon, authenticated;

-- Preserve exact replay protection through a SHA-256 identifier, without payload/device/base fields.
insert into extension_sync_private.legacy_receipts
select user_id, sha256(convert_to(mutation_id,'UTF8')), status, applied_revision, nullif(error,''), created_at
from public.extension_mutations;
CREATE OR REPLACE FUNCTION public.extension_apply_mutation(p_device_id text, p_mutation_id text, p_base_revision bigint, p_operations jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_device_id text := nullif(trim(p_device_id), '');
  v_mutation_id text := nullif(trim(p_mutation_id), '');
  v_current_revision bigint := 0;
  v_next_revision bigint := 0;
  v_existing public.extension_mutations%rowtype;
  v_op jsonb;
  v_type text;
  v_key text;
  v_counter_key text;
  v_date_key text;
  v_date_iso text;
  v_path text;
  v_status text;
  v_tag text;
  v_edocid text;
  v_delta integer := 0;
  v_value integer := 0;
  v_base_count integer := 0;
  v_unique_edocids jsonb := '[]'::jsonb;
  v_row_revision bigint := 0;
  v_conflict_error text := '';
  v_inserted_count integer := 0;
  v_row_count integer := 0;
  v_existing_unique jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if v_device_id is null then
    raise exception 'device_id_required';
  end if;
  if v_mutation_id is null then
    raise exception 'mutation_id_required';
  end if;
  if p_operations is null or jsonb_typeof(p_operations) <> 'array' then
    raise exception 'operations_must_be_array';
  end if;


  select coalesce(jsonb_agg(op order by ordinal), '[]'::jsonb)
    into p_operations
  from jsonb_array_elements(p_operations) with ordinality as items(op, ordinal)
  where not (
    coalesce(op->>'type', '') in ('kv_set', 'kv_delete')
    and coalesce(op->>'key', '') = 'dup_id_card_check_state_v1'
  );

  if jsonb_array_length(p_operations) = 0 then
    return public.extension_build_state(v_user_id)
      || jsonb_build_object('status', 'applied', 'applied_revision',
        coalesce((select revision from public.extension_sync_state where user_id = v_user_id), 0));
  end if;

  select *
    into v_existing
  from public.extension_mutations
  where user_id = v_user_id
    and mutation_id = v_mutation_id;

  if not found then
    select status, applied_revision, error
      into v_existing.status, v_existing.applied_revision, v_existing.error
    from extension_sync_private.legacy_receipts
    where user_id = v_user_id and mutation_hash = sha256(convert_to(v_mutation_id,'UTF8'));
  end if;

  if found then
    return public.extension_build_state(v_user_id)
      || jsonb_build_object(
        'status', v_existing.status,
        'applied_revision', v_existing.applied_revision,
        'error', v_existing.error
      );
  end if;

  insert into public.extension_sync_state (user_id, schema_version, revision)
  values (v_user_id, 2, 0)
  on conflict (user_id) do nothing;

  perform public.extension_ensure_state(v_user_id);

  select revision
    into v_current_revision
  from public.extension_sync_state
  where user_id = v_user_id
  for update;

  if p_base_revision is not null and p_base_revision < v_current_revision then
    for v_op in select value from jsonb_array_elements(p_operations)
    loop
      v_type := coalesce(v_op->>'type', '');
      v_row_revision := 0;

      if v_type in ('counter_increment', 'processed_edocids_add', 'processed_edit_add_edocid') then
        continue;
      elsif v_type in ('kv_set', 'kv_delete') then
        v_key := coalesce(v_op->>'key', '');
        select coalesce(revision, 0)
          into v_row_revision
        from public.extension_user_kv
        where user_id = v_user_id and key = v_key;
      elsif v_type in ('counter_set', 'counter_reset_day') then
        select coalesce(revision, 0)
          into v_row_revision
        from public.extension_counter_days
        where user_id = v_user_id
          and counter_key = coalesce(v_op->>'counter_key', '')
          and date_key = coalesce(v_op->>'date_key', '');
      elsif v_type in ('processed_edit_set', 'processed_edit_delete') then
        select coalesce(revision, 0)
          into v_row_revision
        from public.extension_processed_edits
        where user_id = v_user_id
          and date_iso = coalesce(v_op->>'date_iso', '')
          and path = coalesce(v_op->>'path', '');
      elsif v_type in ('action_rule_set', 'action_rule_delete') then
        select coalesce(revision, 0)
          into v_row_revision
        from public.extension_action_rules
        where user_id = v_user_id
          and path = coalesce(v_op->>'path', '');
      else
        v_conflict_error := 'unknown_operation:' || v_type;
      end if;

      if v_conflict_error = '' and coalesce(v_row_revision, 0) > p_base_revision then
        v_conflict_error := 'revision_mismatch:' || v_type;
      end if;

      if v_conflict_error <> '' then
        insert into public.extension_mutations (
          user_id, mutation_id, device_id, base_revision, operations, status, error
        )
        values (
          v_user_id, v_mutation_id, v_device_id, p_base_revision, '[]'::jsonb, 'conflict', v_conflict_error
        )
        on conflict (user_id, mutation_id) do nothing;

        return public.extension_build_state(v_user_id)
          || jsonb_build_object(
            'status', 'conflict',
            'current_revision', v_current_revision,
            'error', v_conflict_error
          );
      end if;
    end loop;
  end if;

  v_next_revision := v_current_revision + 1;

  for v_op in select value from jsonb_array_elements(p_operations)
  loop
    v_type := coalesce(v_op->>'type', '');

    if v_type = 'kv_set' then
      v_key := coalesce(v_op->>'key', '');
      if not public.extension_is_kv_sync_key(v_key) then
        raise exception 'invalid_kv_key:%', v_key;
      end if;

      insert into public.extension_user_kv (
        user_id, key, value, revision, updated_at, updated_by_device_id, deleted_at
      )
      values (
        v_user_id,
        v_key,
        coalesce(v_op->'value', 'null'::jsonb),
        v_next_revision,
        now(),
        v_device_id,
        null
      )
      on conflict (user_id, key) do update
      set value = excluded.value,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          updated_by_device_id = excluded.updated_by_device_id,
          deleted_at = null;

    elsif v_type = 'kv_delete' then
      v_key := coalesce(v_op->>'key', '');
      if not public.extension_is_kv_sync_key(v_key) then
        raise exception 'invalid_kv_key:%', v_key;
      end if;

      insert into public.extension_user_kv (
        user_id, key, value, revision, updated_at, updated_by_device_id, deleted_at
      )
      values (v_user_id, v_key, 'null'::jsonb, v_next_revision, now(), v_device_id, now())
      on conflict (user_id, key) do update
      set value = 'null'::jsonb,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          updated_by_device_id = excluded.updated_by_device_id,
          deleted_at = excluded.deleted_at;

    elsif v_type = 'counter_increment' then
      v_counter_key := coalesce(v_op->>'counter_key', '');
      v_date_key := coalesce(v_op->>'date_key', '');
      v_delta := public.extension_jsonb_int(v_op->'delta', 0);

      insert into public.extension_counter_days (
        user_id, counter_key, date_key, value, revision, updated_at, updated_by_device_id
      )
      values (v_user_id, v_counter_key, v_date_key, greatest(0, v_delta), v_next_revision, now(), v_device_id)
      on conflict (user_id, counter_key, date_key) do update
      set value = greatest(0, public.extension_counter_days.value + v_delta),
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          updated_by_device_id = excluded.updated_by_device_id;

    elsif v_type = 'counter_set' then
      v_counter_key := coalesce(v_op->>'counter_key', '');
      v_date_key := coalesce(v_op->>'date_key', '');
      v_value := public.extension_jsonb_int(v_op->'value', 0);

      insert into public.extension_counter_days (
        user_id, counter_key, date_key, value, revision, updated_at, updated_by_device_id
      )
      values (v_user_id, v_counter_key, v_date_key, greatest(0, v_value), v_next_revision, now(), v_device_id)
      on conflict (user_id, counter_key, date_key) do update
      set value = excluded.value,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          updated_by_device_id = excluded.updated_by_device_id;

    elsif v_type = 'counter_reset_day' then
      delete from public.extension_counter_days
      where user_id = v_user_id
        and counter_key = coalesce(v_op->>'counter_key', '')
        and date_key = coalesce(v_op->>'date_key', '');

    elsif v_type = 'processed_edocids_add' then
      v_date_iso := coalesce(v_op->>'date_iso', '');
      v_date_key := coalesce(v_op->>'date_key', v_date_iso);
      v_inserted_count := 0;

      for v_edocid in select value from jsonb_array_elements_text(coalesce(v_op->'edocids', '[]'::jsonb))
      loop
        if nullif(trim(v_edocid), '') is not null then
          insert into public.extension_processed_edocids (
            user_id, date_iso, edocid, revision, updated_at, updated_by_device_id
          )
          values (v_user_id, v_date_iso, trim(v_edocid), v_next_revision, now(), v_device_id)
          on conflict (user_id, date_iso, edocid) do nothing;
          get diagnostics v_row_count = row_count;
          v_inserted_count := v_inserted_count + v_row_count;
        end if;
      end loop;

      if v_inserted_count > 0 then
        insert into public.extension_counter_days (
          user_id, counter_key, date_key, value, revision, updated_at, updated_by_device_id
        )
        values (v_user_id, 'stats_history', v_date_key, v_inserted_count, v_next_revision, now(), v_device_id)
        on conflict (user_id, counter_key, date_key) do update
        set value = public.extension_counter_days.value + v_inserted_count,
            revision = excluded.revision,
            updated_at = excluded.updated_at,
            updated_by_device_id = excluded.updated_by_device_id;
      end if;

    elsif v_type = 'processed_edit_add_edocid' then
      v_date_iso := coalesce(v_op->>'date_iso', '');
      v_date_key := coalesce(v_op->>'date_key', v_date_iso);
      v_path := coalesce(v_op->>'path', '');
      v_edocid := trim(coalesce(v_op->>'edocid', ''));

      if v_edocid <> '' then
        select unique_edocids
          into v_existing_unique
        from public.extension_processed_edits
        where user_id = v_user_id
          and date_iso = v_date_iso
          and path = v_path;

        if not found then
          insert into public.extension_processed_edits (
            user_id, date_iso, path, base_count, unique_edocids, revision, updated_at, updated_by_device_id
          )
          values (
            v_user_id, v_date_iso, v_path, 1, jsonb_build_array(v_edocid), v_next_revision, now(), v_device_id
          );
          v_inserted_count := 1;
        elsif not (coalesce(v_existing_unique, '[]'::jsonb) ? v_edocid) then
          update public.extension_processed_edits
          set base_count = base_count + 1,
              unique_edocids = coalesce(unique_edocids, '[]'::jsonb) || jsonb_build_array(v_edocid),
              revision = v_next_revision,
              updated_at = now(),
              updated_by_device_id = v_device_id
          where user_id = v_user_id
            and date_iso = v_date_iso
            and path = v_path;
          v_inserted_count := 1;
        else
          v_inserted_count := 0;
        end if;

        if v_inserted_count > 0 then
          insert into public.extension_counter_days (
            user_id, counter_key, date_key, value, revision, updated_at, updated_by_device_id
          )
          values (v_user_id, 'editing_stats', v_date_key, 1, v_next_revision, now(), v_device_id)
          on conflict (user_id, counter_key, date_key) do update
          set value = public.extension_counter_days.value + 1,
              revision = excluded.revision,
              updated_at = excluded.updated_at,
              updated_by_device_id = excluded.updated_by_device_id;
        end if;
      end if;

    elsif v_type = 'processed_edit_set' then
      v_date_iso := coalesce(v_op->>'date_iso', '');
      v_path := coalesce(v_op->>'path', '');
      v_base_count := greatest(0, public.extension_jsonb_int(v_op->'base_count', 0));
      v_unique_edocids := case
        when jsonb_typeof(v_op->'unique_edocids') = 'array' then v_op->'unique_edocids'
        else '[]'::jsonb
      end;

      insert into public.extension_processed_edits (
        user_id, date_iso, path, base_count, unique_edocids, revision, updated_at, updated_by_device_id
      )
      values (
        v_user_id, v_date_iso, v_path, v_base_count, v_unique_edocids, v_next_revision, now(), v_device_id
      )
      on conflict (user_id, date_iso, path) do update
      set base_count = excluded.base_count,
          unique_edocids = excluded.unique_edocids,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          updated_by_device_id = excluded.updated_by_device_id;

    elsif v_type = 'processed_edit_delete' then
      delete from public.extension_processed_edits
      where user_id = v_user_id
        and date_iso = coalesce(v_op->>'date_iso', '')
        and path = coalesce(v_op->>'path', '');

    elsif v_type = 'action_rule_set' then
      v_path := coalesce(v_op->>'path', '');
      v_status := coalesce(v_op->>'status', '');
      v_tag := nullif(trim(coalesce(v_op->>'tag', '')), '');
      if v_status not in ('approved', 'blocked') then
        raise exception 'invalid_action_rule_status:%', v_status;
      end if;

      insert into public.extension_action_rules (
        user_id, path, status, tag, revision, updated_at, updated_by_device_id
      )
      values (v_user_id, v_path, v_status, v_tag, v_next_revision, now(), v_device_id)
      on conflict (user_id, path) do update
      set status = excluded.status,
          tag = excluded.tag,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          updated_by_device_id = excluded.updated_by_device_id;

    elsif v_type = 'action_rule_delete' then
      delete from public.extension_action_rules
      where user_id = v_user_id
        and path = coalesce(v_op->>'path', '');

    else
      raise exception 'unknown_operation:%', v_type;
    end if;
  end loop;

  update public.extension_sync_state
  set schema_version = 2,
      revision = v_next_revision,
      updated_at = now(),
      updated_by_device_id = v_device_id
  where user_id = v_user_id;

  insert into public.extension_mutations (
    user_id, mutation_id, device_id, base_revision, applied_revision, operations, applied_at, status
  )
  values (
    v_user_id, v_mutation_id, v_device_id, p_base_revision, v_next_revision, '[]'::jsonb, now(), 'applied'
  );

  update public.extension_devices
  set last_seen_at = now()
  where user_id = v_user_id
    and device_id = v_device_id;

  return public.extension_build_state(v_user_id)
    || jsonb_build_object(
      'status', 'applied',
      'applied_revision', v_next_revision
    );
end;
$function$;

CREATE OR REPLACE FUNCTION public.extension_apply_support_reminders_mutation(p_device_id text, p_mutation_id text, p_base_revision bigint, p_operations jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_device_id text := nullif(trim(p_device_id), '');
  v_mutation_id text := nullif(trim(p_mutation_id), '');
  v_current_revision bigint := 0;
  v_next_revision bigint := 0;
  v_existing public.extension_mutations%rowtype;
  v_op jsonb;
  v_type text;
  v_support_key text := 'support_reminders_state_v1';
  v_support_state jsonb := '{}'::jsonb;
  v_reminder jsonb := '{}'::jsonb;
  v_archive jsonb := '{}'::jsonb;
  v_existing_reminder jsonb := '{}'::jsonb;
  v_existing_archive jsonb := '{}'::jsonb;
  v_message_target jsonb := 'null'::jsonb;
  v_request_id text;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if v_device_id is null then
    raise exception 'device_id_required';
  end if;
  if v_mutation_id is null then
    raise exception 'mutation_id_required';
  end if;
  if p_operations is null or jsonb_typeof(p_operations) <> 'array' then
    raise exception 'operations_must_be_array';
  end if;

  if jsonb_array_length(p_operations) = 0 then
    return public.extension_build_state(v_user_id) || jsonb_build_object('status','applied');
  end if;

  select *
    into v_existing
  from public.extension_mutations
  where user_id = v_user_id
    and mutation_id = v_mutation_id;

  if not found then
    select status, applied_revision, error
      into v_existing.status, v_existing.applied_revision, v_existing.error
    from extension_sync_private.legacy_receipts
    where user_id = v_user_id and mutation_hash = sha256(convert_to(v_mutation_id,'UTF8'));
  end if;

  if found then
    return public.extension_build_state(v_user_id)
      || jsonb_build_object(
        'status', v_existing.status,
        'applied_revision', v_existing.applied_revision,
        'error', v_existing.error
      );
  end if;

  insert into public.extension_sync_state (user_id, schema_version, revision)
  values (v_user_id, 2, 0)
  on conflict (user_id) do nothing;

  perform public.extension_ensure_state(v_user_id);

  select revision
    into v_current_revision
  from public.extension_sync_state
  where user_id = v_user_id
  for update;

  v_next_revision := coalesce(v_current_revision, 0) + 1;

  select value
    into v_support_state
  from public.extension_user_kv
  where user_id = v_user_id
    and key = v_support_key
    and deleted_at is null
  for update;

  if not found or v_support_state is null or jsonb_typeof(v_support_state) <> 'object' then
    v_support_state := '{}'::jsonb;
  end if;
  if coalesce(jsonb_typeof(v_support_state->'reminders'), '') <> 'object' then
    v_support_state := jsonb_set(v_support_state, '{reminders}', '{}'::jsonb, true);
  end if;
  if coalesce(jsonb_typeof(v_support_state->'archive'), '') <> 'object' then
    v_support_state := jsonb_set(v_support_state, '{archive}', '{}'::jsonb, true);
  end if;

  for v_op in select value from jsonb_array_elements(p_operations)
  loop
    v_type := coalesce(v_op->>'type', '');

    if v_type = 'support_reminder_set' then
      v_reminder := case
        when jsonb_typeof(v_op->'reminder') = 'object' then v_op->'reminder'
        else '{}'::jsonb
      end;
      v_request_id := nullif(trim(coalesce(v_op->>'request_id', v_reminder->>'requestId')), '');
      if v_request_id is null then
        raise exception 'request_id_required';
      end if;

      v_existing_reminder := case
        when jsonb_typeof(v_support_state->'reminders'->v_request_id) = 'object' then v_support_state->'reminders'->v_request_id
        else '{}'::jsonb
      end;
      v_existing_archive := case
        when jsonb_typeof(v_support_state->'archive'->v_request_id) = 'object' then v_support_state->'archive'->v_request_id
        else '{}'::jsonb
      end;
      if v_reminder ? 'messageTarget' then
        v_message_target := public.extension_normalize_support_message_target(v_reminder->'messageTarget');
      else
        v_message_target := public.extension_normalize_support_message_target(
          coalesce(v_existing_reminder->'messageTarget', v_existing_archive->'messageTarget')
        );
      end if;

      v_reminder := jsonb_set(v_reminder, '{requestId}', to_jsonb(v_request_id), true);
      v_reminder := jsonb_set(v_reminder, '{messageTarget}', v_message_target, true);
      v_support_state := jsonb_set(v_support_state, array['reminders', v_request_id], v_reminder, true);
      v_support_state := v_support_state #- array['archive', v_request_id];

    elsif v_type = 'support_reminder_archive_set' then
      v_archive := case
        when jsonb_typeof(v_op->'archive') = 'object' then v_op->'archive'
        else '{}'::jsonb
      end;
      v_request_id := nullif(trim(coalesce(v_op->>'request_id', v_archive->>'requestId')), '');
      if v_request_id is null then
        raise exception 'request_id_required';
      end if;

      v_existing_archive := case
        when jsonb_typeof(v_support_state->'archive'->v_request_id) = 'object' then v_support_state->'archive'->v_request_id
        else '{}'::jsonb
      end;
      v_existing_reminder := case
        when jsonb_typeof(v_support_state->'reminders'->v_request_id) = 'object' then v_support_state->'reminders'->v_request_id
        else '{}'::jsonb
      end;
      if v_archive ? 'messageTarget' then
        v_message_target := public.extension_normalize_support_message_target(v_archive->'messageTarget');
      else
        v_message_target := public.extension_normalize_support_message_target(
          coalesce(v_existing_archive->'messageTarget', v_existing_reminder->'messageTarget')
        );
      end if;

      v_archive := jsonb_set(v_archive, '{requestId}', to_jsonb(v_request_id), true);
      v_archive := jsonb_set(v_archive, '{messageTarget}', v_message_target, true);
      v_support_state := jsonb_set(v_support_state, array['archive', v_request_id], v_archive, true);
      v_support_state := v_support_state #- array['reminders', v_request_id];

    elsif v_type = 'support_reminder_active_delete' then
      v_request_id := nullif(trim(coalesce(v_op->>'request_id', '')), '');
      if v_request_id is null then
        raise exception 'request_id_required';
      end if;
      v_support_state := v_support_state #- array['reminders', v_request_id];

    elsif v_type = 'support_reminder_archive_delete' then
      v_request_id := nullif(trim(coalesce(v_op->>'request_id', '')), '');
      if v_request_id is null then
        raise exception 'request_id_required';
      end if;
      v_support_state := v_support_state #- array['archive', v_request_id];

    else
      raise exception 'unknown_operation:%', v_type;
    end if;
  end loop;

  insert into public.extension_user_kv (
    user_id, key, value, revision, updated_at, updated_by_device_id, deleted_at
  )
  values (
    v_user_id,
    v_support_key,
    v_support_state,
    v_next_revision,
    now(),
    v_device_id,
    null
  )
  on conflict (user_id, key) do update
  set value = excluded.value,
      revision = excluded.revision,
      updated_at = excluded.updated_at,
      updated_by_device_id = excluded.updated_by_device_id,
      deleted_at = null;

  update public.extension_sync_state
  set schema_version = 2,
      revision = v_next_revision,
      updated_at = now(),
      updated_by_device_id = v_device_id
  where user_id = v_user_id;

  insert into public.extension_mutations (
    user_id, mutation_id, device_id, base_revision, applied_revision, operations, applied_at, status
  )
  values (
    v_user_id, v_mutation_id, v_device_id, p_base_revision, v_next_revision, '[]'::jsonb, now(), 'applied'
  );

  update public.extension_devices
  set last_seen_at = now()
  where user_id = v_user_id
    and device_id = v_device_id;

  return public.extension_build_state(v_user_id)
    || jsonb_build_object(
      'status', 'applied',
      'applied_revision', v_next_revision
    );
end;
$function$;

delete from public.extension_mutations;
select cron.schedule('cleanup-extension-mutations-history', '17 * * * *', $cron$
 delete from public.extension_mutations where created_at < now() - interval '7 days';
 delete from extension_sync_private.legacy_receipts where created_at < now() - interval '7 days';
$cron$);

create function extension_sync_private.apply_v3(p_device_id text,p_sequence bigint,p_mutation_id text,p_base_revision bigint,p_operations jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
 u uuid := auth.uid(); progress extension_sync_private.device_progress%rowtype;
 regular_ops jsonb; support_ops jsonb; result jsonb; revision bigint := 0;
 main_id text; support_id text;
begin
 if u is null then raise exception 'not_authenticated'; end if;
 if nullif(trim(p_device_id),'') is null or length(p_device_id)>200 then raise exception 'invalid_device_id'; end if;
 if p_sequence is null or p_sequence<=0 then raise exception 'invalid_sequence'; end if;
 if nullif(p_mutation_id,'') is null then raise exception 'mutation_id_required'; end if;
 if jsonb_typeof(p_operations) is distinct from 'array' then raise exception 'operations_must_be_array'; end if;
 if jsonb_array_length(p_operations)>2000 or octet_length(p_operations::text)>2097152 then raise exception 'mutation_too_large'; end if;
 insert into extension_sync_private.device_progress(user_id,device_id) values(u,p_device_id) on conflict do nothing;
 select * into progress from extension_sync_private.device_progress where user_id=u and device_id=p_device_id for update;
 select coalesce(s.revision,0) into revision from public.extension_sync_state s where user_id=u;
 revision := coalesce(revision,0);
 if p_sequence<=progress.last_sequence then
   return jsonb_build_object('status','applied','revision',revision,'applied_revision',progress.applied_revision,'duplicate',true);
 end if;
 select coalesce(jsonb_agg(op order by ordinal) filter(where coalesce(op->>'type','') not like 'support_reminder_%'),'[]'::jsonb),
        coalesce(jsonb_agg(op order by ordinal) filter(where coalesce(op->>'type','') like 'support_reminder_%'),'[]'::jsonb)
 into regular_ops,support_ops from jsonb_array_elements(p_operations) with ordinality as t(op,ordinal);
 main_id := p_mutation_id;
 support_id := p_mutation_id;
 if jsonb_array_length(regular_ops)>0 and jsonb_array_length(support_ops)>0 then
   main_id := p_mutation_id || ':main'; support_id := p_mutation_id || ':support';
 end if;
 if jsonb_array_length(regular_ops)>0 then
   result := public.extension_apply_mutation(p_device_id,main_id,p_base_revision,regular_ops);
   if result->>'status'='conflict' then
     delete from public.extension_mutations where user_id=u and mutation_id=main_id;
     return jsonb_build_object('status','conflict','revision',result->'revision',
       'current_revision',result->'current_revision','error',result->'error');
   end if;
 end if;
 if jsonb_array_length(support_ops)>0 then
   result := public.extension_apply_support_reminders_mutation(p_device_id,support_id,p_base_revision,support_ops);
   if result->>'status'='conflict' then
     -- Legacy support conflicts must never partially commit the regular half.
     raise exception 'support_conflict';
   end if;
 end if;
 select coalesce(s.revision,0) into revision from public.extension_sync_state s where user_id=u;
 revision := coalesce(revision,0);
 update extension_sync_private.device_progress set last_sequence=p_sequence,applied_revision=revision,updated_at=now()
 where user_id=u and device_id=p_device_id;
 delete from public.extension_mutations where user_id=u and mutation_id in (main_id,support_id);
 return jsonb_build_object('status','applied','revision',revision,'applied_revision',revision);
end;
$fn$;
revoke all on function extension_sync_private.apply_v3(text,bigint,text,bigint,jsonb) from public;
grant execute on function extension_sync_private.apply_v3(text,bigint,text,bigint,jsonb) to authenticated;
create function public.extension_apply_mutation_v3(p_device_id text,p_sequence bigint,p_mutation_id text,p_base_revision bigint,p_operations jsonb)
returns jsonb language sql security invoker set search_path = '' as $fn$
 select extension_sync_private.apply_v3(p_device_id,p_sequence,p_mutation_id,p_base_revision,p_operations);
$fn$;
revoke all on function public.extension_apply_mutation_v3(text,bigint,text,bigint,jsonb) from public,anon;
grant execute on function public.extension_apply_mutation_v3(text,bigint,text,bigint,jsonb) to authenticated;
CREATE OR REPLACE FUNCTION extension_sync_private.register_v3(p_device_id text, p_device_name text, p_browser text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_device_id text := nullif(trim(p_device_id), '');
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if v_device_id is null then
    raise exception 'device_id_required';
  end if;

  insert into public.extension_devices (
    user_id, device_id, device_name, browser, created_at, last_seen_at
  )
  values (
    v_user_id,
    v_device_id,
    nullif(trim(coalesce(p_device_name, '')), ''),
    nullif(trim(coalesce(p_browser, '')), ''),
    now(),
    now()
  )
  on conflict (user_id, device_id) do update
  set device_name = excluded.device_name,
      browser = excluded.browser,
      last_seen_at = now();

  insert into public.extension_sync_state (user_id, schema_version, revision)
  values (v_user_id, 2, 0)
  on conflict (user_id) do nothing;

  perform public.extension_ensure_state(v_user_id);

  return jsonb_build_object(
    'device_id', v_device_id,
    'registered', true,
    'revision', coalesce((select revision from public.extension_sync_state where user_id=v_user_id),0),
    'last_sequence', coalesce((select last_sequence from extension_sync_private.device_progress where user_id=v_user_id and device_id=v_device_id),0)
  );
end;
$function$;

revoke all on function extension_sync_private.register_v3(text,text,text) from public;
grant execute on function extension_sync_private.register_v3(text,text,text) to authenticated;
create function public.extension_register_device_v3(p_device_id text,p_device_name text default null,p_browser text default null)
returns jsonb language sql security invoker set search_path='' as $fn$
 select extension_sync_private.register_v3(p_device_id,p_device_name,p_browser);
$fn$;
revoke all on function public.extension_register_device_v3(text,text,text) from public,anon;
grant execute on function public.extension_register_device_v3(text,text,text) to authenticated;

create function extension_sync_private.get_v3(p_since_revision bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $fn$
declare u uuid:=auth.uid(); r bigint;
begin
 if u is null then raise exception 'not_authenticated'; end if;
 -- Lock makes revision comparison and snapshot coherent with concurrent writers.
 insert into public.extension_sync_state(user_id,schema_version,revision) values(u,2,0) on conflict do nothing;
 perform public.extension_ensure_state(u);
 select revision into r from public.extension_sync_state where user_id=u for share;
 if p_since_revision is not null and p_since_revision=r then
   return jsonb_build_object('revision',r,'unchanged',true);
 end if;
 return public.extension_build_state(u);
end;
$fn$;
revoke all on function extension_sync_private.get_v3(bigint) from public;
grant execute on function extension_sync_private.get_v3(bigint) to authenticated;
create function public.extension_get_state_v3(p_since_revision bigint default null)
returns jsonb language sql security invoker set search_path='' as $fn$
 select extension_sync_private.get_v3(p_since_revision);
$fn$;
revoke all on function public.extension_get_state_v3(bigint) from public,anon;
grant execute on function public.extension_get_state_v3(bigint) to authenticated;
notify pgrst,'reload schema';
