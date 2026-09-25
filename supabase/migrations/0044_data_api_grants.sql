-- Supabase is retiring the automatic Data API grant it's applied to every
-- new public-schema table/view since project creation: from 2025-10-30, a
-- table with no explicit GRANT is unreachable through supabase-js/
-- PostgREST/GraphQL ("permission denied for table X"). Existing tables in
-- THIS project keep their current (implicit) grants regardless — nothing
-- breaks today — but that implicit state is exactly what a fresh
-- `supabase db reset`, a new project, or a preview branch would no longer
-- get once the automatic behavior is gone, since replaying these
-- migrations from scratch after 2025-10-30 would create every table with
-- NO Data API access at all except where a migration already grants it
-- explicitly (the way 0009/0013/0019/etc. already do for column-scoped
-- UPDATE access).
--
-- This migration makes every table/view's grants fully explicit — a
-- verified match for today's actual effective access, not a broadened
-- one — so this schema stops depending on Supabase's platform-level
-- default at all, on this project or any future clone/reset/branch of it.
-- Every privilege narrowed below (by a targeted revoke, or by never
-- appearing in the broad grant) mirrors an already-existing, deliberate
-- restriction from an earlier migration — cross-checked against every
-- `grant`/`revoke` statement in this project's history before writing
-- this file, not reconstructed from memory.

-- ── 1. Baseline: every table/view gets what Supabase's own automatic
-- behavior already granted it (all four DML privileges to both anon and
-- authenticated) — narrowed back down in step 3 wherever this project has
-- already deliberately narrowed it. This also covers every content/lookup
-- table that's read-only in practice (vocabulary_words, quiz_questions,
-- content_items, etc.) — RLS's own lack of a write policy on those is
-- what actually blocks writes, the same way it already does today; this
-- step only ever restates the outer (table-level) gate, never the inner
-- (row-level) one.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- ── 2. Future-proofing: without this, every table created by a LATER
-- migration would need its own explicit grant added by hand, and
-- forgetting one (easy to do — see 0043's own discovery of exactly this
-- gap for columns) would silently break that table's Data API access the
-- moment it's created in a fresh database, with no warning until
-- something actually tries to use it. No `for role` clause, so this
-- applies to whichever role runs this statement — the same one that will
-- run every later migration's own CREATE TABLE, since they all replay
-- through the same migration pipeline.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- ── 3. Re-apply every existing narrowing, verbatim, so the cumulative
-- state after this migration is identical to production today — the
-- broad grant above is a starting point, not the final word, for each of
-- these.

-- profiles: column-allowlisted UPDATE (0023, 0025, 0034, 0043) — tier,
-- id, username, is_minor, created_at, community_points, referral_points
-- all deliberately excluded.
revoke update on public.profiles from authenticated;
grant update (
  first_name, last_name, full_name, avatar_url, bio, grade, school, city, state, interests,
  platform_os, platform_browser, platform_updated_at, last_active_at,
  cover_url, status, skills, instagram_handle, youtube_handle, github_handle
) on public.profiles to authenticated;

-- posts: only the image fields are directly editable post-create (0009, 0013).
revoke update on public.posts from authenticated;
grant update (image_url, image_width, image_height) on public.posts to authenticated;

-- conversations: only name/icon_url, both admin-gated at the row level by
-- their own RLS policy (0019, 0022).
revoke update on public.conversations from authenticated;
grant update (name, icon_url) on public.conversations to authenticated;

-- community_threads / community_replies: same image-only allowlist as
-- posts (0031, 0033).
revoke update on public.community_threads from authenticated;
grant update (image_url, image_width, image_height) on public.community_threads to authenticated;
revoke update on public.community_replies from authenticated;
grant update (image_url, image_width, image_height) on public.community_replies to authenticated;

-- referrals: read-only via the Data API — every write goes through
-- redeem_referral(), a security-definer function (0040).
revoke insert, update, delete on public.referrals from authenticated;

-- user_safety_summary: not a user-facing view at all — dashboard/
-- service-role only (0034, re-applied on every later rebuild of this
-- view through 0039). The one relation in this schema that should have
-- NO Data API access, at any privilege, for anon or authenticated.
revoke all on public.user_safety_summary from public, anon, authenticated;
