-- messages_sent_count lumped DMs and group chats, sent and received, into
-- one number — not enough signal to actually see a pattern (e.g. someone
-- DMing heavily vs. just active in one big group chat look identical).
-- Splits it into 4: dms_sent_count, dms_received_count,
-- gc_messages_sent_count, gc_messages_received_count.
--
-- Also adds 3 more monitoring columns while touching this:
--   - comments_count: posts_count's counterpart — comments are the
--     higher-volume, lower-friction content surface (also a report
--     target, see reports_received below), worth tracking separately.
--   - group_chats_count: how many group chats this user currently
--     belongs to — a fan-out signal for groups the same way
--     followers/following already are for follows, sitting alongside
--     them rather than the volume columns.
--   - voice_messages_sent_count: voice messages can't be scanned for
--     concerning language the way text can, so how much of a user's
--     messaging is voice is a genuinely different signal than raw
--     volume, not just a subset of it.
--
-- And moves is_minor to the very end — it sat awkwardly between the
-- readable timestamps and grade, more prominent than a single boolean
-- flag needs to be among a dashboard of counts.
--
-- Column reorder + a dropped column both require drop/recreate (CREATE
-- OR REPLACE VIEW only allows appending) — same reasoning as every prior
-- rebuild of this view (0035/0037/0038/0039), with the revoke re-applied
-- at the bottom as always.
drop view if exists public.user_safety_summary;

create view public.user_safety_summary
with (security_invoker = true) as
select
  p.username,
  p.full_name,
  to_char(p.last_active_at at time zone 'Australia/Sydney', 'DD Mon YYYY FMHH12:MI AM') as last_active_at_sydney,
  to_char(p.created_at at time zone 'Australia/Sydney', 'DD Mon YYYY FMHH12:MI AM') as joined_at_sydney,
  p.grade,
  -- Computed from the raw timestamptz, not the formatted text above —
  -- comparisons against now() need to stay timezone-aware.
  (p.last_active_at > now() - interval '5 minutes') as online_now,
  coalesce(reports_received.count, 0) as reports_received,
  coalesce(reports_filed.count, 0) as reports_filed,
  coalesce(followers.count, 0) as followers,
  coalesce(following.count, 0) as following,
  coalesce(group_chats.count, 0) as group_chats_count,
  coalesce(dm_partners.count, 0) as dm_partners_30d,
  coalesce(posts.count, 0) as posts_count,
  coalesce(comments.count, 0) as comments_count,
  coalesce(dms_sent.count, 0) as dms_sent_count,
  coalesce(dms_received.count, 0) as dms_received_count,
  coalesce(gc_sent.count, 0) as gc_messages_sent_count,
  coalesce(gc_received.count, 0) as gc_messages_received_count,
  coalesce(voice_sent.count, 0) as voice_messages_sent_count,
  p.id,
  (p.last_active_at at time zone 'Australia/Sydney') as last_active_at_sydney_raw,
  (p.created_at at time zone 'Australia/Sydney') as joined_at_sydney_raw,
  p.is_minor
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
  select cm.user_id, count(*) as count
  from public.conversation_members cm
  join public.conversations c on c.id = cm.conversation_id and c.type = 'group'
  group by cm.user_id
) group_chats on group_chats.user_id = p.id
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
  select user_id, count(*) as count from public.comments group by user_id
) comments on comments.user_id = p.id
left join (
  select m.sender_id, count(*) as count
  from public.messages m
  join public.conversations c on c.id = m.conversation_id and c.type = 'dm'
  group by m.sender_id
) dms_sent on dms_sent.sender_id = p.id
left join (
  -- The DM's *other* party gets a "received" for every message its
  -- sender sent — same case-expression shape dm_partners above already
  -- uses to find "whichever side isn't the sender".
  select
    case when c.user_a_id = m.sender_id then c.user_b_id else c.user_a_id end as recipient_id,
    count(*) as count
  from public.messages m
  join public.conversations c on c.id = m.conversation_id and c.type = 'dm'
  group by recipient_id
) dms_received on dms_received.recipient_id = p.id
left join (
  select m.sender_id, count(*) as count
  from public.messages m
  join public.conversations c on c.id = m.conversation_id and c.type = 'group'
  group by m.sender_id
) gc_sent on gc_sent.sender_id = p.id
left join (
  -- Every *current* member of the group other than the sender counts
  -- one "received" per message — total message exposure across all of
  -- this user's group chats, the group-chat counterpart to dms_received.
  select cm.user_id, count(*) as count
  from public.messages m
  join public.conversations c on c.id = m.conversation_id and c.type = 'group'
  join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id <> m.sender_id
  group by cm.user_id
) gc_received on gc_received.user_id = p.id
left join (
  select sender_id, count(*) as count
  from public.messages
  where type = 'voice'
  group by sender_id
) voice_sent on voice_sent.sender_id = p.id;

revoke all on public.user_safety_summary from public, anon, authenticated;
