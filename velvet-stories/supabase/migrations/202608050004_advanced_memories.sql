alter table public.memories
  add column if not exists character_id uuid references public.characters(id) on delete cascade,
  add column if not exists category text not null default 'event',
  add column if not exists is_pinned boolean not null default false,
  add column if not exists source text not null default 'automatic',
  add column if not exists updated_at timestamptz not null default now();

update public.memories as memory
set character_id = conversation.character_id
from public.conversations as conversation
where memory.conversation_id = conversation.id
  and memory.character_id is null;

alter table public.memories
  drop constraint if exists memories_category_check;
alter table public.memories
  add constraint memories_category_check
  check (category in ('person', 'relationship', 'world', 'event', 'preference', 'boundary'));

alter table public.memories
  drop constraint if exists memories_source_check;
alter table public.memories
  add constraint memories_source_check
  check (source in ('automatic', 'manual'));

create index if not exists memories_character_priority_idx
on public.memories (user_id, character_id, is_pinned desc, importance desc, updated_at desc);

grant select, insert, update, delete on public.memories to authenticated;

drop policy if exists "Users can update their own memories" on public.memories;
create policy "Users can update their own memories"
on public.memories for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
