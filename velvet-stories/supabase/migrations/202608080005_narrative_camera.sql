-- Velvet Narrative Camera
-- Keeps the story camera coherent and lets NPCs carry scenes naturally.

alter table public.conversations
  add column if not exists narrative_camera text not null default 'balanced',
  add column if not exists inner_thoughts text not null default 'rare';

alter table public.conversations drop constraint if exists conversations_narrative_camera_check;
alter table public.conversations add constraint conversations_narrative_camera_check
  check (narrative_camera in ('user_focused', 'balanced', 'cinematic'));

alter table public.conversations drop constraint if exists conversations_inner_thoughts_check;
alter table public.conversations add constraint conversations_inner_thoughts_check
  check (inner_thoughts in ('rare', 'sometimes', 'frequent'));

grant select, insert, update on table public.conversations to authenticated;
