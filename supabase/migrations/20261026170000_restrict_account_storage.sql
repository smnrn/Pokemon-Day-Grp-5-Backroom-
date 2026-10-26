-- Account names and analytics are served only through the authenticated function.
-- All existing game/companion storage calls use the server-side service role.
alter table public.kv_store_15374a1d enable row level security;
revoke all on table public.kv_store_15374a1d from public, anon, authenticated;
grant select, insert, update, delete on table public.kv_store_15374a1d to service_role;
