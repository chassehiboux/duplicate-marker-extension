create table if not exists public.extension_user_state (
    user_id uuid primary key references auth.users(id) on delete cascade,
    state jsonb not null default '{}'::jsonb,
    state_version integer not null default 1,
    client_updated_at timestamptz,
    updated_at timestamptz not null default now()
);

alter table public.extension_user_state enable row level security;

create or replace function public.set_extension_user_state_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

revoke all on function public.set_extension_user_state_updated_at() from public, anon, authenticated;

drop trigger if exists set_extension_user_state_updated_at on public.extension_user_state;
create trigger set_extension_user_state_updated_at
before update on public.extension_user_state
for each row
execute function public.set_extension_user_state_updated_at();

drop policy if exists "extension_user_state_select_own" on public.extension_user_state;
create policy "extension_user_state_select_own"
on public.extension_user_state
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "extension_user_state_insert_own" on public.extension_user_state;
create policy "extension_user_state_insert_own"
on public.extension_user_state
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "extension_user_state_update_own" on public.extension_user_state;
create policy "extension_user_state_update_own"
on public.extension_user_state
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "extension_user_state_delete_own" on public.extension_user_state;
create policy "extension_user_state_delete_own"
on public.extension_user_state
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.extension_user_state from anon, public;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.extension_user_state to authenticated;
