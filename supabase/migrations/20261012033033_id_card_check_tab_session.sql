-- Состояние просмотра карточек ИД существует только в открытой вкладке.
-- Используем актуальную серверную функцию, сохраняя остальные разрешённые ключи.
do $migration$
declare
  definition text;
  patched text;
begin
  definition := pg_get_functiondef('public.extension_is_kv_sync_key(text)'::regprocedure);
  patched := replace(definition, E'    ''dup_id_card_check_state_v1'',\n', '');
  if patched = definition then
    raise exception 'id_card_key_allowlist_anchor_missing';
  end if;
  execute patched;

  -- Старые клиенты получают успешный no-op, а не бесконечные invalid_kv_key.
  definition := pg_get_functiondef('public.extension_apply_mutation(text,text,bigint,jsonb)'::regprocedure);
  patched := replace(definition, E'  select *\n    into v_existing', $guard$
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
    into v_existing$guard$);
  if patched = definition then
    raise exception 'id_card_mutation_guard_anchor_missing';
  end if;
  execute patched;
end;
$migration$;

-- Удаляем только устаревший временный список, без удаления пользовательских настроек.
delete from public.extension_user_kv where key = 'dup_id_card_check_state_v1';
update public.extension_user_state
set state = state - 'dup_id_card_check_state_v1'
where state ? 'dup_id_card_check_state_v1';
