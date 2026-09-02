-- TalentZify — store each post image's natural pixel dimensions, captured
-- client-side at upload time. Needed so the feed can reserve the correctly
-- shaped box before the image loads (no layout jump), and so the feed can
-- clamp each photo's aspect ratio into an Instagram-like band while the
-- full-view lightbox shows the true, unclamped ratio.
-- Run this in the Supabase SQL editor after 0011_heart_reaction.sql.

alter table public.posts
  add column if not exists image_width integer,
  add column if not exists image_height integer;
