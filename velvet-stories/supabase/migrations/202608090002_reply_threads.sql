-- Velvet Stories V4.1 · Reply + Unfinished Threads

alter table public.messages
  add column if not exists reply_to_message_id uuid references public.messages(id) on delete set null,
  add column if not exists reply_preview text,
  add column if not exists reply_sender text;

alter table public.conversations
  add column if not exists unresolved_threads jsonb not null default '[]'::jsonb;

create index if not exists messages_reply_to_idx
  on public.messages(conversation_id, reply_to_message_id);

grant select, insert, update, delete on table public.messages, public.conversations to authenticated;
