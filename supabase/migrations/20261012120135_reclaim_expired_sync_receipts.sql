-- Empty transitional tables are truncated after expiry so their files/indexes release space too.
select cron.schedule('cleanup-extension-mutations-history','17 * * * *',$cron$
do $cleanup$
begin
 delete from public.extension_mutations where created_at < now() - interval '7 days';
 delete from extension_sync_private.legacy_receipts where created_at < now() - interval '7 days';
 delete from extension_sync_private.legacy_receipt_batches where expires_at<now();
 if not exists(select 1 from public.extension_mutations) then
   truncate public.extension_mutations;
 end if;
 if not exists(select 1 from extension_sync_private.legacy_receipts) then
   truncate extension_sync_private.legacy_receipts;
 end if;
 if not exists(select 1 from extension_sync_private.legacy_receipt_batches) then
   truncate extension_sync_private.legacy_receipt_batches;
 end if;
end;
$cleanup$;
$cron$);
