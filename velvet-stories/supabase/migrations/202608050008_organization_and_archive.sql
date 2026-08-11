alter table public.characters
  add column if not exists is_favorite boolean not null default false,
  add column if not exists tags text[] not null default '{}';

alter table public.conversations
  add column if not exists archived_at timestamptz;

create index if not exists characters_user_favorite_idx
  on public.characters(user_id, is_favorite, updated_at desc);

create index if not exists conversations_user_archived_idx
  on public.conversations(user_id, archived_at, updated_at desc);

