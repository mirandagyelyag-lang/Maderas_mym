alter table public.messages
  add column if not exists edited_at timestamptz;

create table if not exists public.message_alternatives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index if not exists message_alternatives_message_id_idx
  on public.message_alternatives(message_id, created_at);

create index if not exists message_alternatives_user_id_idx
  on public.message_alternatives(user_id);

alter table public.message_alternatives enable row level security;

grant select, insert, update, delete on public.message_alternatives to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
grant select, insert, update, delete on public.memories to authenticated;
grant select, insert, update, delete on public.characters to authenticated;

drop policy if exists "Users can read their message alternatives" on public.message_alternatives;
create policy "Users can read their message alternatives"
  on public.message_alternatives
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their message alternatives" on public.message_alternatives;
create policy "Users can create their message alternatives"
  on public.message_alternatives
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their message alternatives" on public.message_alternatives;
create policy "Users can update their message alternatives"
  on public.message_alternatives
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their message alternatives" on public.message_alternatives;
create policy "Users can delete their message alternatives"
  on public.message_alternatives
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own messages" on public.messages;
create policy "Users can update their own messages"
  on public.messages
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own messages" on public.messages;
create policy "Users can delete their own messages"
  on public.messages
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own characters" on public.characters;
create policy "Users can update their own characters"
  on public.characters
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own characters" on public.characters;
create policy "Users can delete their own characters"
  on public.characters
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can save their own memories" on public.memories;
create policy "Users can save their own memories"
  on public.memories
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own memories" on public.memories;
create policy "Users can delete their own memories"
  on public.memories
  for delete
  to authenticated
  using (auth.uid() = user_id);
