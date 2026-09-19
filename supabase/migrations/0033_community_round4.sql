-- TalentZify — Community round 4: one level of reply-to-reply nesting,
-- reporting, reply images, visible karma support (community_points is
-- already selectable, this just needs no schema change), flair, and
-- save/bookmark. Run this in the Supabase SQL editor after
-- 0032_community_thread_follows_open_select.sql.

-- ── one level of reply nesting ──────────────────────────────────────────
-- Enforced in lib/actions/community.ts's createCommunityReply (app-layer,
-- not a DB constraint) — exactly matching comments.parent_comment_id's
-- own documented convention (0010_comment_threads_and_reactions.sql):
-- "a reply's parent must itself be a top-level comment in practice
-- (enforced by the app, not the DB)... consistent with how lightly this
-- schema is normalized elsewhere."
alter table public.community_replies
  add column if not exists parent_reply_id uuid references public.community_replies(id) on delete cascade;

create index community_replies_parent_reply_id_idx on public.community_replies (parent_reply_id);

-- ── reply images ─────────────────────────────────────────────────────────
alter table public.community_replies
  add column if not exists image_url text,
  add column if not exists image_width integer,
  add column if not exists image_height integer;

-- Same "immutable except this one narrow exception" shape 0031 already
-- set up for community_threads' own image columns, applied here for the
-- same reason: attaching an image *after* the text insert (so a photo
-- problem never costs the reply's own text — see createCommunityReply /
-- createPost's shared convention), with no other column made editable.
create policy "author can update their own reply's image"
  on public.community_replies for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

revoke update on public.community_replies from authenticated;
grant update (image_url, image_width, image_height) on public.community_replies to authenticated;

-- ── flair ────────────────────────────────────────────────────────────────
-- Author-chosen, from a small fixed set — not a per-topic custom-flair
-- system like Reddit's (no moderator role exists to manage one). "Poll"
-- and "Solved" badges are computed at render time instead (has poll
-- options / best_reply_id is not null), not stored here.
alter table public.community_threads
  add column if not exists flair text check (flair in ('question', 'discussion', 'advice', 'resource'));

-- ── reporting ────────────────────────────────────────────────────────────
-- Insert-only from the client's side (no select policy at all) — same
-- "captured now, no public-facing surface yet" posture this schema
-- already uses for things with no admin UI (e.g. quiz_questions, per
-- 0001_init.sql's own comment). A moderation queue to actually review
-- these is a reasonable follow-up, not part of this round.
create table public.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid references public.community_threads(id) on delete cascade,
  reply_id uuid references public.community_replies(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text,
  created_at timestamptz not null default now(),
  check ((thread_id is not null) <> (reply_id is not null))
);

alter table public.community_reports enable row level security;

create policy "users can report as themselves"
  on public.community_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- ── save / bookmark ──────────────────────────────────────────────────────
-- Distinct from community_thread_follows (0031): saving is a purely
-- personal "revisit later" marker, implies no notifications, and — unlike
-- follows — nothing else ever needs to read anyone else's saves, so this
-- stays self-only (no repeat of 0031/0032's "the notify-loop couldn't see
-- other users' rows" bug — there's no analogous loop here).
create table public.community_thread_saves (
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.community_thread_saves enable row level security;

create policy "users can read their own saves"
  on public.community_thread_saves for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can save a thread as themselves"
  on public.community_thread_saves for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can unsave a thread as themselves"
  on public.community_thread_saves for delete
  to authenticated
  using (user_id = auth.uid());
