alter table public.conversations
  add column if not exists is_pinned boolean not null default false;

grant select, insert, update, delete on table public.conversations to authenticated;

drop policy if exists "Users can update their own conversations" on public.conversations;
create policy "Users can update their own conversations"
on public.conversations for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own conversations" on public.conversations;
create policy "Users can delete their own conversations"
on public.conversations for delete to authenticated
using (auth.uid() = user_id);

create index if not exists conversations_user_pinned_updated_idx
on public.conversations (user_id, is_pinned desc, updated_at desc);
