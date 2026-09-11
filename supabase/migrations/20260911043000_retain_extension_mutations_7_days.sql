-- Keep only the recent mutation receipts needed to deduplicate retrying clients.
delete from public.extension_mutations
where created_at < now() - interval '7 days';

-- The operation payload is useful only for short-term diagnostics. Deduplication
-- relies on mutation_id, status and applied_revision, so older payloads can go.
update public.extension_mutations
set operations = '[]'::jsonb
where created_at < now() - interval '1 day'
  and operations <> '[]'::jsonb;

select cron.schedule(
  'cleanup-extension-mutations-history',
  '15 3 * * *',
  $cron$
    delete from public.extension_mutations
    where created_at < now() - interval '7 days';

    update public.extension_mutations
    set operations = '[]'::jsonb
    where created_at < now() - interval '1 day'
      and operations <> '[]'::jsonb
  $cron$
);
