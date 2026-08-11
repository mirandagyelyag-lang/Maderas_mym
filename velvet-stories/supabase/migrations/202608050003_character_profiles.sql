alter table public.characters
  add column if not exists cover_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'character-media', 'character-media', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload their character media" on storage.objects;
create policy "Users can upload their character media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'character-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their character media" on storage.objects;
create policy "Users can update their character media"
on storage.objects for update to authenticated
using (bucket_id = 'character-media' and owner_id = auth.uid()::text)
with check (bucket_id = 'character-media' and owner_id = auth.uid()::text);

drop policy if exists "Users can delete their character media" on storage.objects;
create policy "Users can delete their character media"
on storage.objects for delete to authenticated
using (bucket_id = 'character-media' and owner_id = auth.uid()::text);
