-- Owner-side monitoring: an accurate "last really used the app" signal,
-- plus a consolidated view of per-user safety metrics (reports, DM
-- fan-out, volume). Both are meant to be queried directly via the
-- Supabase SQL editor / service role — nothing here is rendered in the
-- app's own UI. The view (the actually sensitive part — report counts,
-- DM partner counts) is deliberately locked away from the `authenticated`/
-- `anon` roles the app's own client code runs as; see its own comment for
-- why last_active_at itself is NOT locked down the same way.

-- ── last_active_at ──────────────────────────────────────────────────────
-- profiles.platform_updated_at (0025_platform_tracking.sql) only fires on
-- a fresh login (app/auth/actions.ts's signIn, the OAuth callback) —
-- Supabase sessions then refresh silently for a long time, so a user who
-- opens the app daily for weeks can still show a stale login date. This
-- column is touched on every page load instead (throttled app-side, see
-- lib/actions/profile.ts's touchLastActive — the WHERE clause there makes
-- most calls a 0-row no-op, so this stays cheap regardless of traffic),
-- giving a real "last active" signal instead of "last logged in".
alter table public.profiles add column last_active_at timestamptz;

-- Every user can update their OWN row's last_active_at (touchLastActive
-- runs as that user, scoped by the existing "users can update their own
-- profile" RLS policy) — same column-allowlist technique already used for
-- platform_os/platform_browser/platform_updated_at and community_points.
--
-- Deliberately NOT revoking SELECT on this column: profiles' select
-- policy is already `using (true)` — any authenticated user can already
-- read city/school/grade/etc. for anyone else, which is the whole point
-- for a social app (Discover, feed, profile pages). last_active_at isn't
-- meaningfully more sensitive than what's already exposed there, and
-- actually restricting it would mean revoking table-wide SELECT and
-- re-granting the entire existing column list — a much bigger, riskier
-- change than this feature asked for. Nothing in the app's UI queries it,
-- so this is a theoretical exposure, not an active one; revisit if that
-- ever changes.
grant update (last_active_at) on public.profiles to authenticated;

-- ── user_safety_summary ─────────────────────────────────────────────────
-- One consolidated, read-only view for owner-side monitoring: activity
-- recency, report counts (both directions), follow counts, DM fan-out,
-- and content volume, per user. Deliberately a VIEW, not new columns on
-- profiles — profiles gets fetched on nearly every page load in the app,
-- so it stays lean; these are aggregates computed on demand instead.
--
-- security_invoker = true (defense in depth): forces the view to run
-- with the QUERYING role's own privileges/RLS rather than the view
-- owner's — so even if a future grant is ever added by mistake, an
-- ordinary user querying this would still be stopped by the underlying
-- tables' own RLS, not just by the revoke below. The revoke is the real
-- safety boundary; this is a second, independent layer under it.
create view public.user_safety_summary
with (security_invoker = true) as
select
  p.username,
  p.full_name,
  p.is_minor,
  p.grade,
  p.created_at as joined_at,
  p.last_active_at,
  (p.last_active_at > now() - interval '5 minutes') as online_now,
  coalesce(reports_received.count, 0) as reports_received,
  coalesce(reports_filed.count, 0) as reports_filed,
  coalesce(followers.count, 0) as followers,
  coalesce(following.count, 0) as following,
  -- Windowed, unlike the other counts below — a long-time user naturally
  -- accumulates many DM partners over months, which would bury the one
  -- pattern this is actually meant to catch: a previously-quiet or
  -- brand-new account suddenly messaging many different people.
  coalesce(dm_partners.count, 0) as dm_partners_30d,
  coalesce(posts.count, 0) as posts_count,
  coalesce(messages_sent.count, 0) as messages_sent_count,
  p.id
from public.profiles p
-- Reports against this user, combined across both report surfaces: the
-- general `reports` table (post/comment/profile — 0001_init.sql, schema
-- exists but has no UI wired up to it yet) and `community_reports`
-- (thread/reply — 0033_community_round4.sql, actively used). One number
-- either way answers the same question: has this person been reported.
left join (
  select target_user_id, count(*) as count
  from (
    select case r.target_type
      when 'profile' then r.target_id
      when 'post' then posts_r.user_id
      when 'comment' then comments_r.user_id
    end as target_user_id
    from public.reports r
    left join public.posts posts_r on r.target_type = 'post' and posts_r.id = r.target_id
    left join public.comments comments_r on r.target_type = 'comment' and comments_r.id = r.target_id
    union all
    select ct.author_id
    from public.community_reports cr
    join public.community_threads ct on cr.thread_id = ct.id
    union all
    select cre.author_id
    from public.community_reports cr
    join public.community_replies cre on cr.reply_id = cre.id
  ) reported
  where target_user_id is not null
  group by target_user_id
) reports_received on reports_received.target_user_id = p.id
left join (
  select reporter_id, count(*) as count
  from (
    select reporter_id from public.reports
    union all
    select reporter_id from public.community_reports
  ) filed
  group by reporter_id
) reports_filed on reports_filed.reporter_id = p.id
left join (
  select following_id, count(*) as count from public.follows group by following_id
) followers on followers.following_id = p.id
left join (
  select follower_id, count(*) as count from public.follows group by follower_id
) following on following.follower_id = p.id
left join (
  select
    m.sender_id,
    count(distinct case when c.user_a_id = m.sender_id then c.user_b_id else c.user_a_id end) as count
  from public.messages m
  join public.conversations c on c.id = m.conversation_id and c.type = 'dm'
  where m.created_at > now() - interval '30 days'
  group by m.sender_id
) dm_partners on dm_partners.sender_id = p.id
left join (
  select user_id, count(*) as count from public.posts group by user_id
) posts on posts.user_id = p.id
left join (
  select sender_id, count(*) as count from public.messages group by sender_id
) messages_sent on messages_sent.sender_id = p.id;

-- The actual safety boundary: neither the app's normal client role
-- (authenticated) nor anonymous requests can select this at all. Only the
-- service role (SQL editor, dashboard, or a script using the service-role
-- key) can — Postgres's default-privileges setup in this project
-- otherwise auto-grants SELECT on new relations to these roles, so this
-- revoke is not optional.
revoke all on public.user_safety_summary from public, anon, authenticated;
