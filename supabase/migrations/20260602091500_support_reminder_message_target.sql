create or replace function public.extension_normalize_support_message_target(p_target jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_kind text := lower(trim(coalesce(p_target->>'kind', p_target->>'type', '')));
  v_url text;
  v_file_name text;
  v_mime_type text;
  v_data_base64 text;
  v_size_bytes bigint;
  v_size_bytes_text text;
begin
  if p_target is null or jsonb_typeof(p_target) <> 'object' then
    return 'null'::jsonb;
  end if;

  if v_kind = 'url' then
    v_url := nullif(trim(coalesce(p_target->>'url', '')), '');
    if v_url is null then
      return 'null'::jsonb;
    end if;

    return jsonb_build_object(
      'kind', 'url',
      'url', v_url
    );
  end if;

  if v_kind not in ('msg_file', 'msg-file', 'msg') then
    return 'null'::jsonb;
  end if;

  v_data_base64 := nullif(trim(coalesce(p_target->>'dataBase64', p_target->>'base64', '')), '');
  if v_data_base64 is null then
    return 'null'::jsonb;
  end if;

  v_file_name := coalesce(nullif(trim(coalesce(p_target->>'fileName', '')), ''), 'support-message.msg');
  v_mime_type := coalesce(nullif(trim(coalesce(p_target->>'mimeType', '')), ''), 'application/vnd.ms-outlook');
  v_size_bytes_text := trim(coalesce(p_target->>'sizeBytes', ''));

  if v_size_bytes_text ~ '^\d+$' then
    v_size_bytes := greatest(1::bigint, v_size_bytes_text::bigint);
  else
    v_size_bytes := greatest(1::bigint, floor((length(v_data_base64)::numeric * 3) / 4)::bigint);
  end if;

  return jsonb_build_object(
    'kind', 'msg_file',
    'fileName', v_file_name,
    'mimeType', v_mime_type,
    'sizeBytes', v_size_bytes,
    'dataBase64', v_data_base64
  );
end;
$$;

revoke all on function public.extension_normalize_support_message_target(jsonb) from public, anon, authenticated;

create or replace function public.extension_apply_support_reminders_mutation(
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

revoke all on function public.extension_apply_support_reminders_mutation(text, text, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.extension_apply_support_reminders_mutation(text, text, bigint, jsonb) to authenticated;
