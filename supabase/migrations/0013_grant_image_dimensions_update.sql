-- TalentZify — fix "permission denied for table posts" on the new
-- image_width/image_height columns.
--
-- Migration 0009 granted UPDATE on posts scoped to *only* the image_url
-- column (a deliberate column-level grant, not a blanket one — posts still
-- can't otherwise be edited). Postgres column-level privileges require
-- every column named in an UPDATE to be individually granted, or the whole
-- statement is rejected — so createPost's single update() call that now
-- also sets image_width/image_height failed outright once those columns
-- existed, confirmed live: "permission denied for table posts".
-- Run this in the Supabase SQL editor after 0012_post_image_dimensions.sql.

grant update (image_width, image_height) on public.posts to authenticated;
