-- Pack successful legacy receipts by day/hash bucket: one index row per bucket.
create table extension_sync_private.legacy_receipt_batches (
 user_id uuid not null references auth.users(id) on delete cascade,
 receipt_day date not null, bucket smallint not null,
 hashes bytea not null, revisions bigint[] not null, expires_at timestamptz not null,
 primary key(user_id,bucket,receipt_day)
);
alter table extension_sync_private.legacy_receipt_batches enable row level security;
revoke all on extension_sync_private.legacy_receipt_batches from public,anon,authenticated;
insert into extension_sync_private.legacy_receipt_batches
select user_id,(created_at at time zone 'UTC')::date,get_byte(mutation_hash,0),
 string_agg(mutation_hash,''::bytea order by mutation_hash),
 array_agg(applied_revision order by mutation_hash),max(created_at)+interval '7 days'
from extension_sync_private.legacy_receipts where status='applied'
group by user_id,(created_at at time zone 'UTC')::date,get_byte(mutation_hash,0);

create function extension_sync_private.find_legacy_receipt(p_user_id uuid,p_mutation_id text)
returns table(status text,applied_revision bigint,error text)
language plpgsql security invoker set search_path='' as $fn$
declare h bytea:=pg_catalog.sha256(pg_catalog.convert_to(p_mutation_id,'UTF8'));
 b record; lo integer; hi integer; mid integer; candidate bytea;
begin
 return query select r.status,r.applied_revision,r.error from extension_sync_private.legacy_receipts r
 where r.user_id=p_user_id and r.mutation_hash=h;
 if found then return; end if;
 for b in select hashes,revisions from extension_sync_private.legacy_receipt_batches
 where user_id=p_user_id and bucket=pg_catalog.get_byte(h,0)
 loop
   lo:=1;hi:=pg_catalog.octet_length(b.hashes)/32;
   while lo<=hi loop
     mid:=(lo+hi)/2;candidate:=pg_catalog.substring(b.hashes,((mid-1)*32)+1,32);
     if candidate=h then
       return query select 'applied'::text,b.revisions[mid],null::text;
       return;
     elsif candidate<h then lo:=mid+1;
     else hi:=mid-1;
     end if;
   end loop;
 end loop;
end;
$fn$;
revoke all on function extension_sync_private.find_legacy_receipt(uuid,text) from public,anon,authenticated;

do $patch$
declare n text;d text;
begin
 foreach n in array array['extension_apply_mutation','extension_apply_support_reminders_mutation'] loop
  select pg_get_functiondef(p.oid) into d from pg_proc p
  where p.pronamespace='public'::regnamespace and p.proname=n;
  if position('from extension_sync_private.legacy_receipts' in d)=0 then raise exception 'missing legacy lookup in %',n; end if;
  d:=replace(d,
   'from extension_sync_private.legacy_receipts
    where user_id = v_user_id and mutation_hash = sha256(convert_to(v_mutation_id,''UTF8''));',
   'from extension_sync_private.find_legacy_receipt(v_user_id,v_mutation_id);');
  execute d;
 end loop;
end;
$patch$;

delete from extension_sync_private.legacy_receipts where status='applied';
select cron.schedule('cleanup-extension-mutations-history','17 * * * *',$cron$
 delete from public.extension_mutations where created_at < now() - interval '7 days';
 delete from extension_sync_private.legacy_receipts where created_at < now() - interval '7 days';
 delete from extension_sync_private.legacy_receipt_batches where expires_at<now();
$cron$);
