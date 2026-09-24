-- Profile cover photo — same shape as avatars (0005_profile_upgrades.sql):
-- a nullable URL column plus a public-read, folder-per-user storage bucket.

alter table public.profiles add column if not exists cover_url text;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "cover images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "users can upload their own cover"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update their own cover"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own cover"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
