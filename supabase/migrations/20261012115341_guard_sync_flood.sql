alter table extension_sync_private.device_progress
 add column window_started timestamptz not null default '-infinity',
 add column window_count integer not null default 0;
create or replace function extension_sync_private.apply_v3(p_device_id text,p_sequence bigint,p_mutation_id text,p_base_revision bigint,p_operations jsonb)
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
 if progress.window_started > now()-interval '1 minute' and progress.window_count>=30 then
   return jsonb_build_object('status','rate_limited','retry_after_ms',300000);
 end if;
 update extension_sync_private.device_progress
 set window_count=case when window_started>now()-interval '1 minute' then window_count+1 else 1 end,
     window_started=case when window_started>now()-interval '1 minute' then window_started else now() end
 where user_id=u and device_id=p_device_id;
 select coalesce(jsonb_agg(op order by ordinal) filter(where coalesce(op->>'type','') not like 'support_reminder_%'),'[]'::jsonb),
        coalesce(jsonb_agg(op order by ordinal) filter(where coalesce(op->>'type','') like 'support_reminder_%'),'[]'::jsonb)
 into regular_ops,support_ops from jsonb_array_elements(p_operations) with ordinality as t(op,ordinal);
 main_id := p_mutation_id;
 support_id := p_mutation_id;
 if jsonb_array_length(regular_ops)>0 and jsonb_array_length(support_ops)>0 then
   main_id := p_mutation_id || ':main'; support_id := p_mutation_id || ':support';
 end if;
 -- Drop unchanged KV snapshots and retired tab state before applying.
 select coalesce(jsonb_agg(op order by ordinal),'[]'::jsonb) into regular_ops
 from jsonb_array_elements(regular_ops) with ordinality as t(op,ordinal)
 where not (
   coalesce(op->>'type','') in ('kv_set','kv_delete') and (
     coalesce(op->>'key','')='dup_id_card_check_state_v1'
     or (op->>'type'='kv_set' and exists(
       select 1 from public.extension_user_kv k where k.user_id=u and k.key=op->>'key'
       and k.deleted_at is null and k.value=coalesce(op->'value','null'::jsonb)))
     or (op->>'type'='kv_delete' and not exists(
       select 1 from public.extension_user_kv k where k.user_id=u and k.key=op->>'key' and k.deleted_at is null))
   )
 );
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

-- Retire bandwidth-heavy read/registration endpoints. Pending legacy packets can replay through v3.
create or replace function public.extension_register_device(p_device_id text,p_device_name text default null,p_browser text default null)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
begin raise exception 'extension_update_required: update and reload extension'; end;
$fn$;
create or replace function public.extension_get_state(p_since_revision bigint default null)
returns jsonb language plpgsql security invoker set search_path='' as $fn$
begin raise exception 'extension_update_required: update and reload extension'; end;
$fn$;
notify pgrst,'reload schema';
