-- The character-chat Edge Function accesses this table with the service role.
-- Keep it private from browser clients so RLS/GRANT mistakes cannot break chat generation.
alter table public.generation_requests enable row level security;

revoke all on table public.generation_requests from anon, authenticated;

drop policy if exists "generation_requests_own_rows" on public.generation_requests;

grant select, insert, update, delete on table public.generation_requests to service_role;
