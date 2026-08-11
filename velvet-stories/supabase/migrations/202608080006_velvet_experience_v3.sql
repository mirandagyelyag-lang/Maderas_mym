-- Velvet Experience V3
-- Automatic scene continuity, story timeline and simple story presets.

alter table public.conversations
  add column if not exists story_preset text not null default 'natural',
  add column if not exists scene_state jsonb not null default '{}'::jsonb,
  add column if not exists story_timeline jsonb not null default '[]'::jsonb,
  add column if not exists scene_state_updated_at timestamptz;

alter table public.conversations drop constraint if exists conversations_story_preset_check;
alter table public.conversations add constraint conversations_story_preset_check
  check (story_preset in ('natural', 'romantic', 'dramatic', 'slow_burn'));

grant select, insert, update on table public.conversations to authenticated;
