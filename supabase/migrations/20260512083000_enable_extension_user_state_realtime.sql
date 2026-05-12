do $$
begin
    if not exists (
        select 1
        from pg_publication
        where pubname = 'supabase_realtime'
    ) then
        execute 'create publication supabase_realtime';
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'extension_user_state'
    ) then
        execute 'alter publication supabase_realtime add table public.extension_user_state';
    end if;
end;
$$;
