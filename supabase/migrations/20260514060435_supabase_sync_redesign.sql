create table if not exists public.extension_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  device_name text,
  browser text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create table if not exists public.extension_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 2,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by_device_id text
);

create table if not exists public.extension_user_kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  revision bigint not null,
  updated_at timestamptz not null default now(),
  updated_by_device_id text,
  deleted_at timestamptz,
  primary key (user_id, key)
);

create table if not exists public.extension_counter_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  counter_key text not null,
  date_key text not null,
  value integer not null default 0,
  revision bigint not null,
  updated_at timestamptz not null default now(),
  updated_by_device_id text,
  primary key (user_id, counter_key, date_key)
);

create table if not exists public.extension_processed_edits (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_iso text not null,
  path text not null,
  base_count integer not null default 0,
  unique_edocids jsonb not null default '[]'::jsonb,
  revision bigint not null,
  updated_at timestamptz not null default now(),
  updated_by_device_id text,
  primary key (user_id, date_iso, path)
);

create table if not exists public.extension_processed_edocids (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_iso text not null,
  edocid text not null,
  revision bigint not null,
  updated_at timestamptz not null default now(),
  updated_by_device_id text,
  primary key (user_id, date_iso, edocid)
);

create table if not exists public.extension_action_rules (
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  status text not null check (status in ('approved', 'blocked')),
  tag text,
  revision bigint not null,
  updated_at timestamptz not null default now(),
  updated_by_device_id text,
  primary key (user_id, path)
);

create table if not exists public.extension_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id text not null,
  device_id text not null,
  base_revision bigint,
  applied_revision bigint,
  operations jsonb not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  status text not null default 'applied',
  error text,
  primary key (user_id, mutation_id)
);

alter table public.extension_devices enable row level security;
alter table public.extension_sync_state enable row level security;
alter table public.extension_user_kv enable row level security;
alter table public.extension_counter_days enable row level security;
alter table public.extension_processed_edits enable row level security;
alter table public.extension_processed_edocids enable row level security;
alter table public.extension_action_rules enable row level security;
alter table public.extension_mutations enable row level security;

drop policy if exists "extension_devices_select_own" on public.extension_devices;
create policy "extension_devices_select_own"
on public.extension_devices for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "extension_sync_state_select_own" on public.extension_sync_state;
create policy "extension_sync_state_select_own"
on public.extension_sync_state for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "extension_user_kv_select_own" on public.extension_user_kv;
create policy "extension_user_kv_select_own"
on public.extension_user_kv for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "extension_counter_days_select_own" on public.extension_counter_days;
create policy "extension_counter_days_select_own"
on public.extension_counter_days for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "extension_processed_edits_select_own" on public.extension_processed_edits;
create policy "extension_processed_edits_select_own"
on public.extension_processed_edits for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "extension_processed_edocids_select_own" on public.extension_processed_edocids;
create policy "extension_processed_edocids_select_own"
on public.extension_processed_edocids for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "extension_action_rules_select_own" on public.extension_action_rules;
create policy "extension_action_rules_select_own"
on public.extension_action_rules for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "extension_mutations_select_own" on public.extension_mutations;
create policy "extension_mutations_select_own"
on public.extension_mutations for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.extension_devices from anon, public;
revoke all on table public.extension_sync_state from anon, public;
revoke all on table public.extension_user_kv from anon, public;
revoke all on table public.extension_counter_days from anon, public;
revoke all on table public.extension_processed_edits from anon, public;
revoke all on table public.extension_processed_edocids from anon, public;
revoke all on table public.extension_action_rules from anon, public;
revoke all on table public.extension_mutations from anon, public;

grant select on table public.extension_devices to authenticated;
grant select on table public.extension_sync_state to authenticated;
grant select on table public.extension_user_kv to authenticated;
grant select on table public.extension_counter_days to authenticated;
grant select on table public.extension_processed_edits to authenticated;
grant select on table public.extension_processed_edocids to authenticated;
grant select on table public.extension_action_rules to authenticated;
grant select on table public.extension_mutations to authenticated;

create or replace function public.extension_is_kv_sync_key(p_key text)
returns boolean
language sql
stable
as $$
  select coalesce(p_key, '') = any (array[
    'setting_copy_mode',
    'setting_highlight_mode',
    'setting_notify_execution',
    'setting_notify_editing',
    'setting_department_containers',
    'list_DebtID',
    'list_AccAddress_AccountNumber',
    'list_Individual_FullName',
    'list_CaseNumber',
    'list_EDNumber',
    'strict_CaseNumber',
    'strict_EDNumber',
    'dup_show_hidden_departments',
    'dup_fsspreestr_group_duplicates',
    'pyramid_christmas_v10_enabled',
    'pyramid_spring_enabled',
    'pyramid_theme_feature_settings_v1',
    'vzid_last_claim_type',
    'vzid_last_claim_type_label',
    'vzid_last_claim_type_updated_at',
    'dup_google_sheets_problem_picker_bridge_url',
    'support_reminders_state_v1',
    'dup_execution_analysis_params_v1',
    'dup_execution_analysis_state_v1',
    'dup_id_card_check_state_v1'
  ])
  or coalesce(p_key, '') like 'jqgrid_settings_%'
  or (
    coalesce(p_key, '') like 'dup_ui_show_%'
    and coalesce(p_key, '') <> all (array[
      'dup_ui_show_stage_timer',
      'dup_ui_show_stage_timer_toggle',
      'dup_ui_show_stage_timer_abort'
    ])
  );
$$;

create or replace function public.extension_jsonb_int(p_value jsonb, p_default integer default 0)
returns integer
language sql
immutable
as $$
  select case
    when p_value is null then p_default
    when jsonb_typeof(p_value) = 'number' and (p_value #>> '{}') ~ '^-?[0-9]+$'
      then (p_value #>> '{}')::integer
    when jsonb_typeof(p_value) = 'string' and trim(both '"' from p_value::text) ~ '^-?[0-9]+$'
      then trim(both '"' from p_value::text)::integer
    else p_default
  end;
$$;

create or replace function public.extension_build_state(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_revision bigint := 0;
  v_schema_version integer := 2;
  v_kv jsonb := '{}'::jsonb;
  v_counter_days jsonb := '[]'::jsonb;
  v_processed_edits jsonb := '[]'::jsonb;
  v_processed_edocids jsonb := '[]'::jsonb;
  v_action_rules jsonb := '[]'::jsonb;
begin
  select revision, schema_version
    into v_revision, v_schema_version
  from public.extension_sync_state
  where user_id = p_user_id;

  select coalesce(jsonb_object_agg(key, value order by key), '{}'::jsonb)
    into v_kv
  from public.extension_user_kv
  where user_id = p_user_id
    and deleted_at is null;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'counter_key', counter_key,
      'date_key', date_key,
      'value', value,
      'revision', revision,
      'updated_at', updated_at,
      'updated_by_device_id', updated_by_device_id
    )
    order by counter_key, date_key
  ), '[]'::jsonb)
    into v_counter_days
  from public.extension_counter_days
  where user_id = p_user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date_iso', date_iso,
      'path', path,
      'base_count', base_count,
      'unique_edocids', unique_edocids,
      'revision', revision,
      'updated_at', updated_at,
      'updated_by_device_id', updated_by_device_id
    )
    order by date_iso, path
  ), '[]'::jsonb)
    into v_processed_edits
  from public.extension_processed_edits
  where user_id = p_user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date_iso', date_iso,
      'edocid', edocid,
      'revision', revision,
      'updated_at', updated_at,
      'updated_by_device_id', updated_by_device_id
    )
    order by date_iso, edocid
  ), '[]'::jsonb)
    into v_processed_edocids
  from public.extension_processed_edocids
  where user_id = p_user_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'path', path,
      'status', status,
      'tag', tag,
      'revision', revision,
      'updated_at', updated_at,
      'updated_by_device_id', updated_by_device_id
    )
    order by path
  ), '[]'::jsonb)
    into v_action_rules
  from public.extension_action_rules
  where user_id = p_user_id;

  return jsonb_build_object(
    'schema_version', coalesce(v_schema_version, 2),
    'revision', coalesce(v_revision, 0),
    'kv', coalesce(v_kv, '{}'::jsonb),
    'counter_days', coalesce(v_counter_days, '[]'::jsonb),
    'processed_edits', coalesce(v_processed_edits, '[]'::jsonb),
    'processed_edocids', coalesce(v_processed_edocids, '[]'::jsonb),
    'action_rules', coalesce(v_action_rules, '[]'::jsonb),
    'server_time', now()
  );
end;
$$;

create or replace function public.extension_ensure_state(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_revision bigint := 0;
  v_legacy jsonb := null;
  v_has_new_state boolean := false;
  v_kv record;
  v_day record;
  v_path record;
  v_tag_map jsonb := '{}'::jsonb;
  v_text text;
  v_base_count integer := 0;
  v_unique_edocids jsonb := '[]'::jsonb;
  v_inserted boolean := false;
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.extension_sync_state (user_id, schema_version, revision)
  values (p_user_id, 2, 0)
  on conflict (user_id) do nothing;

  select revision
    into v_revision
  from public.extension_sync_state
  where user_id = p_user_id
  for update;

  if coalesce(v_revision, 0) > 0 then
    return;
  end if;

  select exists (select 1 from public.extension_user_kv where user_id = p_user_id)
      or exists (select 1 from public.extension_counter_days where user_id = p_user_id)
      or exists (select 1 from public.extension_processed_edits where user_id = p_user_id)
      or exists (select 1 from public.extension_processed_edocids where user_id = p_user_id)
      or exists (select 1 from public.extension_action_rules where user_id = p_user_id)
    into v_has_new_state;

  if v_has_new_state then
    update public.extension_sync_state
    set revision = 1,
        updated_at = now(),
        updated_by_device_id = 'existing-new-state'
    where user_id = p_user_id;
    return;
  end if;

  select state
    into v_legacy
  from public.extension_user_state
  where user_id = p_user_id
  limit 1;

  if v_legacy is null or jsonb_typeof(v_legacy) <> 'object' then
    return;
  end if;

  for v_kv in select key, value from jsonb_each(v_legacy)
  loop
    if public.extension_is_kv_sync_key(v_kv.key) then
      insert into public.extension_user_kv (
        user_id, key, value, revision, updated_at, updated_by_device_id
      )
      values (p_user_id, v_kv.key, coalesce(v_kv.value, 'null'::jsonb), 1, now(), 'legacy-migration')
      on conflict (user_id, key) do update
      set value = excluded.value,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          updated_by_device_id = excluded.updated_by_device_id,
          deleted_at = null;
      v_inserted := true;
    end if;
  end loop;

  if jsonb_typeof(v_legacy->'stats_history') = 'object' then
    for v_day in select key, value from jsonb_each(v_legacy->'stats_history')
    loop
      insert into public.extension_counter_days (
        user_id, counter_key, date_key, value, revision, updated_at, updated_by_device_id
      )
      values (
        p_user_id,
        'stats_history',
        v_day.key,
        greatest(0, public.extension_jsonb_int(v_day.value, 0)),
        1,
        now(),
        'legacy-migration'
      )
      on conflict (user_id, counter_key, date_key) do update
      set value = excluded.value,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          updated_by_device_id = excluded.updated_by_device_id;
      v_inserted := true;
    end loop;
  end if;

  if jsonb_typeof(v_legacy->'editing_stats') = 'object' then
    for v_day in select key, value from jsonb_each(v_legacy->'editing_stats')
    loop
      insert into public.extension_counter_days (
        user_id, counter_key, date_key, value, revision, updated_at, updated_by_device_id
      )
      values (
        p_user_id,
        'editing_stats',
        v_day.key,
        greatest(0, public.extension_jsonb_int(v_day.value, 0)),
        1,
        now(),
        'legacy-migration'
      )
      on conflict (user_id, counter_key, date_key) do update
      set value = excluded.value,
          revision = excluded.revision,
          updated_at = excluded.updated_at,
          updated_by_device_id = excluded.updated_by_device_id;
      v_inserted := true;
    end loop;
  end if;

  if jsonb_typeof(v_legacy->'processed_edits') = 'object' then
    for v_day in select key, value from jsonb_each(v_legacy->'processed_edits')
    loop
      if jsonb_typeof(v_day.value) = 'object' then
        for v_path in select key, value from jsonb_each(v_day.value)
        loop
          v_base_count := 0;
          v_unique_edocids := '[]'::jsonb;

          if jsonb_typeof(v_path.value) = 'object' then
            v_base_count := greatest(0, public.extension_jsonb_int(v_path.value->'base_count', 0));
            if jsonb_typeof(v_path.value->'unique_edocids') = 'array' then
              v_unique_edocids := v_path.value->'unique_edocids';
            end if;
          elsif jsonb_typeof(v_path.value) = 'array' then
            v_base_count := jsonb_array_length(v_path.value);
            v_unique_edocids := v_path.value;
          else
            v_base_count := greatest(0, public.extension_jsonb_int(v_path.value, 0));
          end if;

          insert into public.extension_processed_edits (
            user_id, date_iso, path, base_count, unique_edocids, revision, updated_at, updated_by_device_id
          )
          values (
            p_user_id,
            v_day.key,
            v_path.key,
            v_base_count,
            v_unique_edocids,
            1,
            now(),
            'legacy-migration'
          )
          on conflict (user_id, date_iso, path) do update
          set base_count = excluded.base_count,
              unique_edocids = excluded.unique_edocids,
              revision = excluded.revision,
              updated_at = excluded.updated_at,
              updated_by_device_id = excluded.updated_by_device_id;
          v_inserted := true;
        end loop;
      end if;
    end loop;
  end if;

  if jsonb_typeof(v_legacy->'processed_edocids') = 'object' then
    for v_day in select key, value from jsonb_each(v_legacy->'processed_edocids')
    loop
      if jsonb_typeof(v_day.value) = 'array' then
        for v_text in select value from jsonb_array_elements_text(v_day.value)
        loop
          if nullif(trim(v_text), '') is not null then
            insert into public.extension_processed_edocids (
              user_id, date_iso, edocid, revision, updated_at, updated_by_device_id
            )
            values (p_user_id, v_day.key, trim(v_text), 1, now(), 'legacy-migration')
            on conflict (user_id, date_iso, edocid) do nothing;
            v_inserted := true;
          end if;
        end loop;
      end if;
    end loop;
  end if;

  if jsonb_typeof(v_legacy->'action_tags') = 'object' then
    v_tag_map := v_legacy->'action_tags';
  end if;

  if jsonb_typeof(v_legacy->'approved_actions') = 'array' then
    for v_text in select value from jsonb_array_elements_text(v_legacy->'approved_actions')
    loop
      if nullif(trim(v_text), '') is not null then
        insert into public.extension_action_rules (
          user_id, path, status, tag, revision, updated_at, updated_by_device_id
        )
        values (p_user_id, trim(v_text), 'approved', nullif(v_tag_map->>trim(v_text), ''), 1, now(), 'legacy-migration')
        on conflict (user_id, path) do update
        set status = excluded.status,
            tag = excluded.tag,
            revision = excluded.revision,
            updated_at = excluded.updated_at,
            updated_by_device_id = excluded.updated_by_device_id;
        v_inserted := true;
      end if;
    end loop;
  end if;

  if jsonb_typeof(v_legacy->'blocked_actions') = 'array' then
    for v_text in select value from jsonb_array_elements_text(v_legacy->'blocked_actions')
    loop
      if nullif(trim(v_text), '') is not null then
        insert into public.extension_action_rules (
          user_id, path, status, tag, revision, updated_at, updated_by_device_id
        )
        values (p_user_id, trim(v_text), 'blocked', nullif(v_tag_map->>trim(v_text), ''), 1, now(), 'legacy-migration')
        on conflict (user_id, path) do update
        set status = excluded.status,
            tag = excluded.tag,
            revision = excluded.revision,
            updated_at = excluded.updated_at,
            updated_by_device_id = excluded.updated_by_device_id;
        v_inserted := true;
      end if;
    end loop;
  end if;

  if v_inserted then
    update public.extension_sync_state
    set revision = 1,
        updated_at = now(),
        updated_by_device_id = 'legacy-migration'
    where user_id = p_user_id;
  end if;
end;
$$;

create or replace function public.extension_register_device(
  p_device_id text,
  p_device_name text,
  p_browser text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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
    'state', public.extension_build_state(v_user_id)
  );
end;
$$;

create or replace function public.extension_get_state(p_since_revision bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.extension_sync_state (user_id, schema_version, revision)
  values (v_user_id, 2, 0)
  on conflict (user_id) do nothing;

  perform public.extension_ensure_state(v_user_id);

  return public.extension_build_state(v_user_id);
end;
$$;

create or replace function public.extension_apply_mutation(
  p_device_id text,
  p_mutation_id text,
  p_base_revision bigint,
  p_operations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
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

  select *
    into v_existing
  from public.extension_mutations
  where user_id = v_user_id
    and mutation_id = v_mutation_id;

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
          v_user_id, v_mutation_id, v_device_id, p_base_revision, p_operations, 'conflict', v_conflict_error
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
    v_user_id, v_mutation_id, v_device_id, p_base_revision, v_next_revision, p_operations, now(), 'applied'
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
$$;

revoke all on function public.extension_is_kv_sync_key(text) from public, anon, authenticated;
revoke all on function public.extension_jsonb_int(jsonb, integer) from public, anon, authenticated;
revoke all on function public.extension_build_state(uuid) from public, anon, authenticated;
revoke all on function public.extension_ensure_state(uuid) from public, anon, authenticated;
revoke all on function public.extension_register_device(text, text, text) from public, anon, authenticated;
revoke all on function public.extension_get_state(bigint) from public, anon, authenticated;
revoke all on function public.extension_apply_mutation(text, text, bigint, jsonb) from public, anon, authenticated;

grant execute on function public.extension_register_device(text, text, text) to authenticated;
grant execute on function public.extension_get_state(bigint) to authenticated;
grant execute on function public.extension_apply_mutation(text, text, bigint, jsonb) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'extension_sync_state'
  ) then
    execute 'alter publication supabase_realtime add table public.extension_sync_state';
  end if;
end $$;
