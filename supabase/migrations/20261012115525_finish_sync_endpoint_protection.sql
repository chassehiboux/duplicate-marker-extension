-- Prevent bypassing v3 through the retired write endpoints.
revoke execute on function public.extension_apply_mutation(text,text,bigint,jsonb) from public,anon,authenticated;
revoke execute on function public.extension_apply_support_reminders_mutation(text,text,bigint,jsonb) from public,anon,authenticated;

-- Serialize no-op comparison with other devices before deciding to skip a write.
do $patch$
declare d text;
begin
 select pg_get_functiondef('extension_sync_private.apply_v3(text,bigint,text,bigint,jsonb)'::regprocedure) into d;
 d:=replace(d,
 ' if progress.window_started > now()-interval ''1 minute''',
 ' insert into public.extension_sync_state(user_id,schema_version,revision) values(u,2,0) on conflict do nothing;
 select s.revision into revision from public.extension_sync_state s where user_id=u for update;
 if progress.window_started > now()-interval ''1 minute''');
 execute d;
end;
$patch$;
notify pgrst,'reload schema';
