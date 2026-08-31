-- TalentZify — real post image upload, replacing the paste-a-URL hack.
-- Run this in the Supabase SQL editor after 0007_fix_delete_own_account.sql.

insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "post images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'post-images');

create policy "users can upload their own post images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No update policy: posts aren't editable today, only created/deleted, so
-- there's no "replace an existing post image" flow to support.

create policy "users can delete their own post images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
