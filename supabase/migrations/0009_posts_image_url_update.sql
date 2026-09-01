-- TalentZify — fix silently-dropped post images.
--
-- createPost creates the post row first, then attaches the image via a
-- follow-up `update posts set image_url = ... where id = ...`. That update
-- was silently doing nothing: `posts` never had an UPDATE policy at all, so
-- Postgres RLS matched zero rows — no error, just 0 rows affected, which
-- PostgREST/supabase-js don't surface as a failure. Confirmed live: the
-- image uploaded to storage fine, but the post's image_url stayed null and
-- the file was left orphaned in the bucket.
--
-- Fixed narrowly: allow authenticated users to update ONLY the image_url
-- column on their own posts, everything else about a post (content,
-- user_id, etc.) is still not editable, matching every comment already in
-- the codebase saying posts can only be created/deleted, never edited.
-- Run this in the Supabase SQL editor after 0008_post_images_storage.sql.

revoke update on public.posts from authenticated;
grant update (image_url) on public.posts to authenticated;

create policy "users can attach an image to their own post"
  on public.posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
