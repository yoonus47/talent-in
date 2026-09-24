-- Discovered live-testing the cover photo feature: `authenticated` does
-- NOT hold a blanket table-level UPDATE grant on public.profiles — it
-- only has column-level UPDATE grants for an established list of columns
-- (bio, school, interests, etc. all work; a fresh ALTER TABLE ADD COLUMN
-- is NOT automatically included in that list). Proved directly: the same
-- authenticated session that successfully updates `bio` gets 42501
-- ("permission denied for table profiles") updating `cover_url`.
--
-- This means every column added by 0041_cover_photo.sql and
-- 0042_profile_flair.sql is currently unwritable by real users, even
-- though nothing in either migration revoked anything — they were just
-- never granted in the first place. Fixing that here, additively; safe to
-- run regardless of whether 0042 has already been applied (a grant on a
-- column that doesn't exist yet would error, so this assumes 0042 runs
-- first if it hasn't already — run them in order).
grant update (cover_url) on public.profiles to authenticated;
grant update (status, skills, instagram_handle, youtube_handle, github_handle) on public.profiles to authenticated;
