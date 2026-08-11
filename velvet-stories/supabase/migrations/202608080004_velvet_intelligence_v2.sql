-- Velvet Intelligence V2
-- Rich character profiles, advanced per-conversation controls and branching metadata.

alter table public.characters
  add column if not exists character_values text,
  add column if not exists fears text,
  add column if not exists habits text,
  add column if not exists contradictions text,
  add column if not exists speech_style text,
  add column if not exists boundaries text,
  add column if not exists scenario text,
  add column if not exists example_dialogue text;

alter table public.conversations
  add column if not exists romance_intensity smallint not null default 35,
  add column if not exists initiative smallint not null default 65,
  add column if not exists drama smallint not null default 45,
  add column if not exists flirting smallint not null default 30,
  add column if not exists humor smallint not null default 45,
  add column if not exists description_level smallint not null default 55,
  add column if not exists character_independence smallint not null default 80,
  add column if not exists dialogue_frequency smallint not null default 55,
  add column if not exists branch_parent_id uuid references public.conversations(id) on delete set null,
  add column if not exists branch_from_message_id uuid references public.messages(id) on delete set null,
  add column if not exists branch_label text;

alter table public.conversations drop constraint if exists conversations_romance_intensity_check;
alter table public.conversations add constraint conversations_romance_intensity_check check (romance_intensity between 0 and 100);
alter table public.conversations drop constraint if exists conversations_initiative_check;
alter table public.conversations add constraint conversations_initiative_check check (initiative between 0 and 100);
alter table public.conversations drop constraint if exists conversations_drama_check;
alter table public.conversations add constraint conversations_drama_check check (drama between 0 and 100);
alter table public.conversations drop constraint if exists conversations_flirting_check;
alter table public.conversations add constraint conversations_flirting_check check (flirting between 0 and 100);
alter table public.conversations drop constraint if exists conversations_humor_check;
alter table public.conversations add constraint conversations_humor_check check (humor between 0 and 100);
alter table public.conversations drop constraint if exists conversations_description_level_check;
alter table public.conversations add constraint conversations_description_level_check check (description_level between 0 and 100);
alter table public.conversations drop constraint if exists conversations_character_independence_check;
alter table public.conversations add constraint conversations_character_independence_check check (character_independence between 0 and 100);
alter table public.conversations drop constraint if exists conversations_dialogue_frequency_check;
alter table public.conversations add constraint conversations_dialogue_frequency_check check (dialogue_frequency between 0 and 100);

create index if not exists conversations_branch_parent_idx
  on public.conversations(user_id, branch_parent_id, updated_at desc);

grant select, insert, update, delete on table public.characters, public.conversations, public.messages to authenticated;

alter table public.lore_entries drop constraint if exists lore_entries_type_check;
alter table public.lore_entries add constraint lore_entries_type_check
  check (entry_type in ('character', 'location', 'group', 'rule', 'event', 'family', 'organization', 'relationship', 'secret'));

alter table public.personas
  add column if not exists goals text,
  add column if not exists preferences text,
  add column if not exists boundaries text,
  add column if not exists speech_style text;

alter table public.memories
  add column if not exists scope text not null default 'conversation';

alter table public.memories drop constraint if exists memories_scope_check;
alter table public.memories add constraint memories_scope_check
  check (scope in ('conversation', 'character'));

create index if not exists memories_scope_lookup_idx
  on public.memories(user_id, character_id, scope, conversation_id, is_pinned desc, importance desc);

