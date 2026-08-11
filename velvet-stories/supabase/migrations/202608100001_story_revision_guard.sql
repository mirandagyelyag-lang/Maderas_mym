-- Prevent stale background AI tasks from restoring story state after a rewind,
-- delete, edit, response switch, or a newer turn.
alter table public.conversations
  add column if not exists story_revision uuid not null default gen_random_uuid();

create index if not exists conversations_story_revision_idx
  on public.conversations(id, story_revision);
