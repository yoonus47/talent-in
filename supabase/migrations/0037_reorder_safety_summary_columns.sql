-- Reorder-only: last_active_at_sydney -> 3rd column, joined_at_sydney ->
-- 4th, for easier scanning in the Table Editor. Postgres won't let
-- CREATE OR REPLACE VIEW reorder existing columns (it only allows
-- appending new ones at the end), so this drops and recreates again —
-- same reasoning as 0035, and the same re-applied revoke at the bottom
-- for the same reason (drop wipes the view's privileges).
drop view if exists public.user_safety_summary;

create view public.user_safety_summary
with (security_invoker = true) as
select
  p.username,
  p.full_name,
  (p.last_active_at at time zone 'Australia/Sydney') as last_active_at_sydney,
  (p.created_at at time zone 'Australia/Sydney') as joined_at_sydney,
  p.is_minor,
  p.grade,
  -- Computed from the raw timestamptz, before the display conversion
  -- above — comparisons against now() need to stay timezone-aware, not
  -- run against the plain-timestamp display value.
  (p.last_active_at > now() - interval '5 minutes') as online_now,
  coalesce(reports_received.count, 0) as reports_received,
  coalesce(reports_filed.count, 0) as reports_filed,
  coalesce(followers.count, 0) as followers,
  coalesce(following.count, 0) as following,
  coalesce(dm_partners.count, 0) as dm_partners_30d,
  coalesce(posts.count, 0) as posts_count,
  coalesce(messages_sent.count, 0) as messages_sent_count,
  p.id
from public.profiles p
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

revoke all on public.user_safety_summary from public, anon, authenticated;
