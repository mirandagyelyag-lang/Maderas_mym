alter table public.conversations
  add column if not exists response_length_override text,
  add column if not exists narration_style_override text,
  add column if not exists creativity numeric(3,2) not null default 0.84;

alter table public.conversations drop constraint if exists conversations_response_length_override_check;
alter table public.conversations add constraint conversations_response_length_override_check
check (response_length_override is null or response_length_override in ('short', 'balanced', 'long'));

alter table public.conversations drop constraint if exists conversations_narration_style_override_check;
alter table public.conversations add constraint conversations_narration_style_override_check
check (narration_style_override is null or narration_style_override in ('dialogue', 'balanced', 'immersive'));

alter table public.conversations drop constraint if exists conversations_creativity_check;
alter table public.conversations add constraint conversations_creativity_check
check (creativity between 0.20 and 1.20);
