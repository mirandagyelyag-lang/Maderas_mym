-- Velvet Stories V4 · Story Engine
-- Persistent story intelligence, chapters, cast state, relationship progression and bookmarks.

alter table public.conversations
  add column if not exists pacing_mode text not null default 'natural',
  add column if not exists relationship_state jsonb not null default '{}'::jsonb,
  add column if not exists cast_state jsonb not null default '{}'::jsonb,
  add column if not exists story_chapters jsonb not null default '[]'::jsonb,
  add column if not exists active_chapter jsonb not null default '{}'::jsonb,
  add column if not exists story_engine_version smallint not null default 4;

alter table public.conversations drop constraint if exists conversations_pacing_mode_check;
alter table public.conversations add constraint conversations_pacing_mode_check
  check (pacing_mode in ('quick', 'natural', 'cinematic'));

-- V4 gives private-thought control more useful semantics while keeping old values valid.
alter table public.conversations drop constraint if exists conversations_inner_thoughts_check;
alter table public.conversations add constraint conversations_inner_thoughts_check
  check (inner_thoughts in ('none', 'rare', 'important', 'sometimes', 'literary', 'frequent'));

alter table public.messages
  add column if not exists is_bookmarked boolean not null default false,
  add column if not exists bookmark_label text,
  add column if not exists chapter_number integer;

create index if not exists messages_bookmarked_idx
  on public.messages(user_id, conversation_id, is_bookmarked, created_at desc);

create index if not exists conversations_story_engine_idx
  on public.conversations(user_id, character_id, story_engine_version, updated_at desc);

grant select, insert, update, delete on table public.conversations, public.messages to authenticated;
