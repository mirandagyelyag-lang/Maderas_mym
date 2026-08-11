create table if not exists public.generation_requests (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid null references public.conversations(id) on delete cascade,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generation_requests enable row level security;

drop policy if exists "generation_requests_own_rows" on public.generation_requests;
create policy "generation_requests_own_rows" on public.generation_requests
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists generation_requests_user_id_idx on public.generation_requests(user_id);
