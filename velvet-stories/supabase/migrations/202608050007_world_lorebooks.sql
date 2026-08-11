create table if not exists public.lorebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  description text,
  genre text,
  color text not null default '#7a2942',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lore_entries (
  id uuid primary key default gen_random_uuid(),
  lorebook_id uuid not null references public.lorebooks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null default 'rule',
  name text not null check (char_length(name) between 1 and 120),
  content text not null check (char_length(content) between 1 and 4000),
  keywords text[] not null default '{}',
  event_date text,
  is_active boolean not null default true,
  always_include boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lore_entries_type_check check (entry_type in ('character', 'location', 'group', 'rule', 'event'))
);

alter table public.conversations
  add column if not exists lorebook_id uuid references public.lorebooks(id) on delete set null;

alter table public.lorebooks enable row level security;
alter table public.lore_entries enable row level security;
grant select, insert, update, delete on public.lorebooks, public.lore_entries to authenticated;

drop policy if exists "Users manage their own lorebooks" on public.lorebooks;
create policy "Users manage their own lorebooks" on public.lorebooks for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users manage their own lore entries" on public.lore_entries;
create policy "Users manage their own lore entries" on public.lore_entries for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists lorebooks_user_updated_idx on public.lorebooks(user_id, updated_at desc);
create index if not exists lore_entries_book_type_idx on public.lore_entries(lorebook_id, entry_type, is_active);
