create table if not exists public.personas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  pronouns text,
  age text,
  role text,
  appearance text,
  personality text,
  background text,
  notes text,
  image_url text,
  color text not null default '#7a2942',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.personas enable row level security;
grant select, insert, update, delete on public.personas to authenticated;

drop policy if exists "Users can read their own personas" on public.personas;
create policy "Users can read their own personas" on public.personas for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can create their own personas" on public.personas;
create policy "Users can create their own personas" on public.personas for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update their own personas" on public.personas;
create policy "Users can update their own personas" on public.personas for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their own personas" on public.personas;
create policy "Users can delete their own personas" on public.personas for delete to authenticated using (auth.uid() = user_id);

create unique index if not exists personas_one_default_per_user
on public.personas (user_id) where is_default = true;

alter table public.conversations
  add column if not exists persona_id uuid references public.personas(id) on delete set null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('persona-media', 'persona-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their persona media" on storage.objects;
create policy "Users can upload their persona media" on storage.objects for insert to authenticated
with check (bucket_id = 'persona-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Users can delete their persona media" on storage.objects;
create policy "Users can delete their persona media" on storage.objects for delete to authenticated
using (bucket_id = 'persona-media' and owner_id = auth.uid()::text);
