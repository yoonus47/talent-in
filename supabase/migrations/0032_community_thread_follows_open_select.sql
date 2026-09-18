-- TalentZify — fixes a real bug found during live verification of
-- 0031_community_round3.sql: community_thread_follows' select policy was
-- copied from community_thread_reads' ("only ever read your own row"),
-- but that reasoning doesn't transfer — a read-watermark really is
-- purely personal, while the follower LIST has to be readable by whoever
-- is about to post a reply (createCommunityReply, lib/actions/
-- community.ts, queries every follower of a thread to notify them all,
-- not just the author). Under the old policy, that query silently came
-- back filtered down to just the replier's own row via RLS — no error,
-- just zero notifications sent to anyone else, including the original
-- thread author. Run this in the Supabase SQL editor after
-- 0031_community_round3.sql.
--
-- Not a privacy regression: who reacted to a thread (community_thread_
-- reactions) and who voted which way in its poll (community_poll_votes)
-- are already both openly readable by any authenticated user — "follows
-- this thread" is the same class of low-sensitivity activity, not more
-- revealing than a visible reply already is.
drop policy if exists "users can read their own thread follows" on public.community_thread_follows;

create policy "thread follows are readable by authenticated users"
  on public.community_thread_follows for select
  to authenticated
  using (true);
