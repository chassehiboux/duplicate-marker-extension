-- Execute the entire file as one transaction. All test data is rolled back.
begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users limit 1),true);
insert into extension_sync_private.legacy_receipts(user_id,mutation_hash,status,applied_revision,error,created_at)
values(auth.uid(),sha256(convert_to('quota-legacy','UTF8')),'applied',123,null,now());
insert into extension_sync_private.legacy_receipt_batches(user_id,receipt_day,bucket,hashes,revisions,expires_at)
select auth.uid(),'1900-01-01',get_byte(h,0),string_agg(h,''::bytea order by h),
array_agg(i::bigint order by h),now()+interval '7 days'
from (select i,sha256(convert_to('quota-packed-'||i,'UTF8')) h from generate_series(1,1000) i) t
group by get_byte(h,0);
do $t$
declare i integer; r record;
begin
 for i in 1..1000 loop
  select * into r from extension_sync_private.find_legacy_receipt(auth.uid(),'quota-packed-'||i);
  if not found or r.applied_revision<>i then raise exception 'packed lookup failed for %',i; end if;
 end loop;
 if exists(select 1 from extension_sync_private.find_legacy_receipt(auth.uid(),'quota-packed-absent')) then raise exception 'false packed match'; end if;
end;
$t$;
set local role authenticated;
do $t$
declare a jsonb;b jsonb;r bigint;i integer;
begin
 a:=public.extension_register_device_v3('quota-test','test','test');
 if a ? 'state' then raise exception 'full registration response'; end if;
 a:=public.extension_apply_mutation_v3('quota-test',1,'quota-one',null,
 '[{"type":"counter_increment","counter_key":"quota_test_only","date_key":"test","delta":1}]');
 r:=(a->>'revision')::bigint;
 b:=public.extension_apply_mutation_v3('quota-test',1,'quota-one',null,
 '[{"type":"counter_increment","counter_key":"quota_test_only","date_key":"test","delta":1}]');
 if b->>'duplicate'<>'true' or (b->>'revision')::bigint<>r then raise exception 'duplicate replay'; end if;
 b:=public.extension_get_state_v3(r);
 if b->>'unchanged'<>'true' or b ? 'kv' then raise exception 'conditional snapshot'; end if;
 b:=public.extension_apply_mutation_v3('quota-test',2,'quota-empty',r,'[]');
 if (b->>'revision')::bigint<>r then raise exception 'empty changed revision'; end if;
 b:=public.extension_apply_mutation_v3('quota-test',3,'quota-set',r,
 '[{"type":"counter_set","counter_key":"quota_test_only","date_key":"test","value":3}]');
 b:=public.extension_apply_mutation_v3('quota-test',4,'quota-conflict',r,
 '[{"type":"counter_set","counter_key":"quota_test_only","date_key":"test","value":4}]');
 if b->>'status'<>'conflict' then raise exception 'conflict missing'; end if;
 b:=public.extension_apply_mutation_v3('quota-test',4,'quota-rebased',(b->>'revision')::bigint,
 '[{"type":"counter_set","counter_key":"quota_test_only","date_key":"test","value":4}]');
 if b->>'status'<>'applied' then raise exception 'rebase failed'; end if;
 b:=public.extension_apply_mutation_v3('quota-test',5,'quota-legacy',null,
 '[{"type":"counter_increment","counter_key":"quota_test_only","date_key":"test","delta":100}]');
 b:=public.extension_apply_mutation_v3('quota-test',6,'quota-packed-500',null,
 '[{"type":"counter_increment","counter_key":"quota_test_only","date_key":"test","delta":100}]');
 begin
  perform public.extension_apply_mutation_v3('quota-test',7,'quota-mixed-bad',null,
  '[{"type":"counter_increment","counter_key":"quota_test_only","date_key":"test","delta":100},{"type":"support_reminder_unknown"}]');
  raise exception 'expected invalid support rejection';
 exception when others then
  if sqlerrm='expected invalid support rejection' then raise; end if;
 end;
 b:=public.extension_apply_mutation_v3('quota-test',7,'quota-kv',null,
 '[{"type":"kv_set","key":"setting_copy_mode","value":"quota-test-only"}]');
 r:=(b->>'revision')::bigint;
 b:=public.extension_apply_mutation_v3('quota-test',8,'quota-kv-same',null,
 '[{"type":"kv_set","key":"setting_copy_mode","value":"quota-test-only"}]');
 if (b->>'revision')::bigint<>r then raise exception 'unchanged kv bumped revision'; end if;
 for i in 1..30 loop
  b:=public.extension_apply_mutation_v3('quota-flood-test',i,'quota-flood-'||i,null,'[]');
  if b->>'status'<>'applied' then raise exception 'unexpected early throttle'; end if;
 end loop;
 b:=public.extension_apply_mutation_v3('quota-flood-test',31,'quota-flood-31',null,'[]');
 if b->>'status'<>'rate_limited' then raise exception 'flood not stopped'; end if;
 begin
  perform public.extension_register_device('quota-old','test','test');
  raise exception 'expected old endpoint rejection';
 exception when others then
  if sqlerrm='expected old endpoint rejection' then raise; end if;
 end;
end;
$t$;
reset role;
do $t$
begin
 if (select value from public.extension_counter_days where user_id=auth.uid() and counter_key='quota_test_only' and date_key='test')<>4 then raise exception 'duplicate counter or failed atomic rollback'; end if;
 if exists(select 1 from public.extension_mutations where user_id=auth.uid() and device_id like 'quota-%') then raise exception 'journal not empty'; end if;
 if (select last_sequence from extension_sync_private.device_progress where user_id=auth.uid() and device_id='quota-flood-test')<>30 then raise exception 'rejected packet advanced watermark'; end if;
 if has_table_privilege('authenticated','extension_sync_private.device_progress','UPDATE') or
 has_function_privilege('anon','public.extension_apply_mutation_v3(text,bigint,text,bigint,jsonb)','EXECUTE') or
 has_function_privilege('authenticated','public.extension_apply_mutation(text,text,bigint,jsonb)','EXECUTE')
 then raise exception 'permissions regression'; end if;
end;
$t$;
rollback;
select 'Passed: 1000 packed lookups, lost reply, legacy replay, empty/unchanged KV, conditional read, conflict/rebase, atomic rollback, flood limit, retired endpoints, permissions; test data rolled back.' as tests;
