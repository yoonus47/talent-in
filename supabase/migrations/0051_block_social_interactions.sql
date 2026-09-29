-- TalentZify — closes a gap in 0048_user_blocking.sql: that migration's
-- own header only ever promised "neither can follow, DM, or view the
-- other's profile" and gated exactly those three surfaces. Reactions,
-- comments, and community replies/reactions were never touched, so a
-- blocked pair could still post directly onto each other's posts/threads
-- (and, via 0050's group-chat extension being the only other precedent,
-- there was no equivalent for public content at all). This closes that:
-- a blocked pair can no longer react to, comment on, or reply to content
-- the *other* one specifically owns (their post, their comment, their
-- community thread, their community reply) — mirroring exactly how
-- 0048 already stops new follows/DMs between the same pair.
--
-- Deliberately INSERT/UPDATE-time only, not a SELECT-time hide — same
-- scope choice 0050's own comment already documents for DMs ("an existing
-- DM conversation's history still stays visible after a block, only new
-- messages are refused"). This migration keeps that same shape: existing
-- comments/reactions/replies from before a block stay visible (nothing
-- retroactively disappears), and a third party's post/thread is
-- untouched even if the blocked person comments on *that* — this is
-- about the blocked pair's own content, not a platform-wide filter.
-- lib/notify.ts separately no-ops any notification between a blocked
-- pair, since a @mention's recipient is arbitrary and unrelated to the
-- post/comment/thread ownership checked here.

-- ── reactions (post reactions) ──────────────────────────────────────────
create or replace function public.post_owner_blocked(p_post_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select public.users_blocked_each_other(auth.uid(), po.user_id)
       from public.posts po where po.id = p_post_id),
    false
  );
$$;

grant execute on function public.post_owner_blocked(uuid) to authenticated;

drop policy "users can like as themselves" on public.reactions;

create policy "users can like as themselves"
  on public.reactions for insert
  to authenticated
  with check (auth.uid() = user_id and not public.post_owner_blocked(post_id));

drop policy "users can change their own reaction" on public.reactions;

create policy "users can change their own reaction"
  on public.reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not public.post_owner_blocked(post_id));

-- ── comments ─────────────────────────────────────────────────────────────
-- A reply targets its parent comment's author, not necessarily the post's
-- author — both are checked, since a reply is the more direct of the two.
create or replace function public.comment_target_blocked(p_post_id uuid, p_parent_comment_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select public.users_blocked_each_other(auth.uid(), po.user_id)
       from public.posts po where po.id = p_post_id),
    false
  )
  or coalesce(
    (select public.users_blocked_each_other(auth.uid(), pc.user_id)
       from public.comments pc where pc.id = p_parent_comment_id),
    false
  );
$$;

grant execute on function public.comment_target_blocked(uuid, uuid) to authenticated;

drop policy "users can comment as themselves" on public.comments;

create policy "users can comment as themselves"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not public.comment_target_blocked(post_id, parent_comment_id)
  );

-- ── comment_reactions ────────────────────────────────────────────────────
create or replace function public.comment_owner_blocked(p_comment_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select public.users_blocked_each_other(auth.uid(), c.user_id)
       from public.comments c where c.id = p_comment_id),
    false
  );
$$;

grant execute on function public.comment_owner_blocked(uuid) to authenticated;

drop policy "users can react to comments as themselves" on public.comment_reactions;

create policy "users can react to comments as themselves"
  on public.comment_reactions for insert
  to authenticated
  with check (auth.uid() = user_id and not public.comment_owner_blocked(comment_id));

drop policy "users can change their own comment reaction" on public.comment_reactions;

create policy "users can change their own comment reaction"
  on public.comment_reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not public.comment_owner_blocked(comment_id));

-- ── community_replies ────────────────────────────────────────────────────
create or replace function public.community_thread_owner_blocked(p_thread_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select public.users_blocked_each_other(auth.uid(), t.author_id)
       from public.community_threads t where t.id = p_thread_id),
    false
  );
$$;

grant execute on function public.community_thread_owner_blocked(uuid) to authenticated;

drop policy "users can reply as themselves" on public.community_replies;

create policy "users can reply as themselves"
  on public.community_replies for insert
  to authenticated
  with check (auth.uid() = author_id and not public.community_thread_owner_blocked(thread_id));

-- ── community_thread_reactions ──────────────────────────────────────────
drop policy "users can react to threads as themselves" on public.community_thread_reactions;

create policy "users can react to threads as themselves"
  on public.community_thread_reactions for insert
  to authenticated
  with check (auth.uid() = user_id and not public.community_thread_owner_blocked(thread_id));

drop policy "users can change their own thread reaction" on public.community_thread_reactions;

create policy "users can change their own thread reaction"
  on public.community_thread_reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not public.community_thread_owner_blocked(thread_id));

-- ── community_reply_reactions ───────────────────────────────────────────
create or replace function public.community_reply_owner_blocked(p_reply_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select public.users_blocked_each_other(auth.uid(), r.author_id)
       from public.community_replies r where r.id = p_reply_id),
    false
  );
$$;

grant execute on function public.community_reply_owner_blocked(uuid) to authenticated;

drop policy "users can react to replies as themselves" on public.community_reply_reactions;

create policy "users can react to replies as themselves"
  on public.community_reply_reactions for insert
  to authenticated
  with check (auth.uid() = user_id and not public.community_reply_owner_blocked(reply_id));

drop policy "users can change their own reply reaction" on public.community_reply_reactions;

create policy "users can change their own reply reaction"
  on public.community_reply_reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and not public.community_reply_owner_blocked(reply_id));
