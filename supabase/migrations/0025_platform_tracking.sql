-- TalentZify — coarse device/platform tracking.
-- Run this in the Supabase SQL editor after 0024_fix_message_delete_realtime.sql.
--
-- No device/browser info has ever been captured anywhere in this app —
-- came up trying to answer "how many users are on iOS vs Android" and
-- finding there was simply no data. This adds three columns, set from the
-- User-Agent header at signup (lib/actions/profile.ts's completeOnboarding
-- — the actual first point a profiles row exists) and refreshed on every
-- subsequent login (app/auth/actions.ts's signIn, app/auth/callback's
-- route handler). Coarse categories only ("ios"/"android"/"chrome"/
-- "safari"/etc, see lib/user-agent.ts) — not a raw User-Agent string —
-- deliberately, since that's all the actual question needs and it's far
-- less identifying to store.
alter table public.profiles
  add column platform_os text,
  add column platform_browser text,
  add column platform_updated_at timestamptz;

-- Same column-allowlist technique as 0019/0022's conversations grants —
-- the existing "users can update their own profile" policy (0001_init.sql)
-- is row-scoped only, so without this, the previous grant (first_name,
-- last_name, full_name, avatar_url, bio, grade, school, city, state,
-- interests — see 0023_voice_messages.sql) simply wouldn't cover these
-- new columns and every write attempt would be silently rejected.
grant update (platform_os, platform_browser, platform_updated_at) on public.profiles to authenticated;
