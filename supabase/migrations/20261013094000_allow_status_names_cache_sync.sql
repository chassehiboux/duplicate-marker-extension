-- Добавляем кэш названий ТМ к актуальному allowlist, сохраняя все прежние правила.
do $migration$
declare
  definition text;
  patched text;
begin
  if not public.extension_is_kv_sync_key('dup_status_names_cache_v1') then
    definition := pg_get_functiondef('public.extension_is_kv_sync_key(text)'::regprocedure);
    patched := replace(definition, 'select coalesce(p_key, '''') = any (array[',
      'select coalesce(p_key, '''') = ''dup_status_names_cache_v1'' or coalesce(p_key, '''') = any (array[');
    if patched = definition then
      raise exception 'status_names_allowlist_anchor_missing';
    end if;
    execute patched;
  end if;
end;
$migration$;
