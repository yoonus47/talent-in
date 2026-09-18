-- TalentZify — Community round 3: anonymous posting, following a thread
-- (fixes the real gap where only the thread author ever got notified of
-- new replies — a follower now does too), best-answer marking,
-- author-pinned threads, image attachments, single-choice polls, and a
-- community-participation points ledger folded into the dashboard's
-- existing "total points" stat. Run this in the Supabase SQL editor after
-- 0030_community_reactions_and_activity.sql.

-- ── community_threads: new columns ──────────────────────────────────────
alter table public.community_threads
  add column if not exists is_anonymous boolean not null default false,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists image_url text,
  add column if not exists image_width integer,
  add column if not exists image_height integer,
  add column if not exists best_reply_id uuid references public.community_replies(id) on delete set null;

-- is_anonymous hides the author in the UI only — author_id is still
-- stored (needed for ownership checks: delete, pin, best-answer, and this
-- same anonymity toggle itself) and still present in the raw API payload
-- to anyone inspecting network traffic. Same trust level as every other
-- "hidden in the UI, not hidden from the platform" convention already in
-- this app — not true/cryptographic anonymity.

-- community_threads has never had a general update policy (0028's own
-- "immutable once posted" convention) — createCommunityThread still needs
-- one narrow exception: attaching image_url/width/height *after* the
-- insert, same "text must never be lost to a photo problem" two-step
-- createPost already uses for posts (lib/actions/posts.ts). RLS alone
-- can't restrict an authorized update to specific columns, so this pairs
-- a normal row-level policy with an explicit column-level grant — the
-- same technique used below for profiles.community_points, just in the
-- opposite direction (there: revoke one column, leave the rest as-is;
-- here: revoke everything, then re-grant only the three image columns).
-- best_reply_id/is_pinned stay untouched by this — they're only ever
-- written by the two SECURITY DEFINER functions further down, which run
-- as the function owner and bypass this grant/revoke entirely.
create policy "author can update their own thread's image"
  on public.community_threads for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

revoke update on public.community_threads from authenticated;
grant update (image_url, image_width, image_height) on public.community_threads to authenticated;

-- ── community_thread_follows ────────────────────────────────────────────
-- Drives who gets notified of a new reply (lib/actions/community.ts's
-- createCommunityReply notifies every follower, not just the original
-- author) and the "Following" filter on /community. The thread author is
-- auto-followed at creation time; anyone who replies is auto-followed too
-- — both in application code, not a trigger, since both already have a
-- natural insert to piggyback on.
create table public.community_thread_follows (
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.community_thread_follows enable row level security;

create policy "users can read their own thread follows"
  on public.community_thread_follows for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can follow a thread as themselves"
  on public.community_thread_follows for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can unfollow a thread as themselves"
  on public.community_thread_follows for delete
  to authenticated
  using (user_id = auth.uid());

-- ── community_poll_options / community_poll_votes ───────────────────────
-- A poll is 1:1 with the thread that carries it (no separate "polls"
-- header row — "thread has options" already answers "is this a poll").
-- Options are only ever written once, by createCommunityThread right
-- after inserting the thread itself — the insert check below scopes that
-- to "the thread this options row points at was created by me," a plain
-- subquery (unlike best_reply_id/is_pinned, which need a SECURITY
-- DEFINER function because THOSE are updates to an already-immutable
-- row's protected columns — this is a fresh insert, no such conflict).
create table public.community_poll_options (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  position smallint not null
);

create index community_poll_options_thread_id_idx on public.community_poll_options (thread_id);

alter table public.community_poll_options enable row level security;

create policy "poll options are readable by authenticated users"
  on public.community_poll_options for select
  to authenticated
  using (true);

-- Technically permits the author to insert options into an existing
-- thread at any later time too, not just at creation — RLS alone can't
-- express "only within the same request as the thread insert." Harmless
-- in practice: no UI path ever calls this outside createCommunityThread,
-- and a thread's title/body/reply immutability is unaffected either way.
create policy "thread author can add poll options"
  on public.community_poll_options for insert
  to authenticated
  with check (
    exists (
      select 1 from public.community_threads t
      where t.id = thread_id and t.author_id = auth.uid()
    )
  );

-- One vote per user per poll (thread) — re-voting changes option_id on
-- the same row rather than adding a second one, so switching your vote
-- is a plain update, not a delete+insert.
create table public.community_poll_votes (
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  option_id uuid not null references public.community_poll_options(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index community_poll_votes_option_id_idx on public.community_poll_votes (option_id);

alter table public.community_poll_votes enable row level security;

create policy "poll votes are readable by authenticated users"
  on public.community_poll_votes for select
  to authenticated
  using (true);

create policy "users can vote as themselves"
  on public.community_poll_votes for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can change their own vote"
  on public.community_poll_votes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can retract their own vote"
  on public.community_poll_votes for delete
  to authenticated
  using (user_id = auth.uid());

-- ── best-answer marking, author-only pinning ────────────────────────────
-- Both go through a SECURITY DEFINER function rather than a plain RLS
-- update policy: community_threads deliberately has no update policy at
-- all today ("immutable once posted," 0028's own comment) — an
-- auth.uid()=author_id policy would let a client PATCH title/body too,
-- since RLS can't restrict *which column* an authorized update touches.
-- Same pattern as sync_community_thread_activity (0028) / promote_next_
-- admin (0019_group_chats.sql).
create or replace function public.set_community_best_reply(p_thread_id uuid, p_reply_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.community_threads
    where id = p_thread_id and author_id = auth.uid()
  ) then
    raise exception 'only the thread author can mark a best reply';
  end if;
  if p_reply_id is not null and not exists (
    select 1 from public.community_replies where id = p_reply_id and thread_id = p_thread_id
  ) then
    raise exception 'that reply does not belong to this thread';
  end if;
  update public.community_threads set best_reply_id = p_reply_id where id = p_thread_id;
end;
$$;

-- This project revokes EXECUTE from PUBLIC by default on every new public-
-- schema function (see how every prior custom RPC in this codebase —
-- get_daily_challenge, create_group_conversation, etc. — needs this same
-- explicit grant) — without it, the app couldn't call this at all.
grant execute on function public.set_community_best_reply(uuid, uuid) to authenticated;

create or replace function public.set_community_thread_pinned(p_thread_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.community_threads
    where id = p_thread_id and author_id = auth.uid()
  ) then
    raise exception 'only the thread author can pin this thread';
  end if;
  update public.community_threads set is_pinned = p_pinned where id = p_thread_id;
end;
$$;

grant execute on function public.set_community_thread_pinned(uuid, boolean) to authenticated;

-- ── notifications: community_best_answer ────────────────────────────────
-- Reuses the existing community_thread_id/community_reply_id reference
-- columns (0030) — no new columns needed, just one more type value.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'follow', 'reaction', 'comment', 'share', 'reply', 'mention', 'comment_reaction',
    'group_added', 'community_reply', 'community_reaction', 'community_mention',
    'community_best_answer'
  ));

-- ── community participation points ──────────────────────────────────────
-- A running counter, not a ledger table — matches this app's existing
-- lightweight style. Deliberately NOT reachable via a normal client
-- update: profiles' broad self-update policy (0001_init.sql, auth.uid() =
-- id) is row-level, not column-level, so without this explicit revoke a
-- user could PATCH their own community_points directly over the client
-- API, bypassing every trigger below entirely — the same gap already
-- accepted for `tier` elsewhere in this schema, closed here instead since
-- the delete-triggers below only mean anything if the column truly can't
-- be hand-edited around them.
alter table public.profiles add column if not exists community_points integer not null default 0;
revoke update (community_points) on public.profiles from authenticated;

-- Trusts its caller completely (no internal ownership check — it applies
-- whatever delta to whatever user_id it's given) because its only
-- intended callers are the SECURITY DEFINER trigger functions below,
-- which run as this function's owner regardless of grants. Postgres
-- grants EXECUTE on a newly created function to PUBLIC by default, so
-- without the revoke just below, any authenticated client could call
-- this directly over the RPC endpoint and award themselves arbitrary
-- points — unlike set_community_best_reply/set_community_thread_pinned
-- above, which stay client-callable on purpose because they carry their
-- own auth.uid()-based ownership check internally, this one has none and
-- must never be reachable directly.
create or replace function public.award_community_points(p_user_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set community_points = community_points + p_delta where id = p_user_id;
end;
$$;

revoke execute on function public.award_community_points(uuid, integer) from public, authenticated, anon;

create or replace function public.on_community_thread_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.award_community_points(new.author_id, 5);
  elsif tg_op = 'DELETE' then
    perform public.award_community_points(old.author_id, -5);
  end if;
  return null;
end;
$$;

create trigger community_thread_points_trigger
  after insert or delete on public.community_threads
  for each row execute function public.on_community_thread_points();

create or replace function public.on_community_reply_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.award_community_points(new.author_id, 2);
  elsif tg_op = 'DELETE' then
    perform public.award_community_points(old.author_id, -2);
  end if;
  return null;
end;
$$;

create trigger community_reply_points_trigger
  after insert or delete on public.community_replies
  for each row execute function public.on_community_reply_points();

-- Symmetric on purpose: marking, then unmarking, then re-marking the same
-- reply nets to zero rather than compounding — the old best reply's
-- author loses 10 the instant a different (or no) reply takes its place.
create or replace function public.on_community_best_reply_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_author uuid;
  new_author uuid;
begin
  if new.best_reply_id is distinct from old.best_reply_id then
    if old.best_reply_id is not null then
      select author_id into old_author from public.community_replies where id = old.best_reply_id;
      if old_author is not null then
        perform public.award_community_points(old_author, -10);
      end if;
    end if;
    if new.best_reply_id is not null then
      select author_id into new_author from public.community_replies where id = new.best_reply_id;
      if new_author is not null then
        perform public.award_community_points(new_author, 10);
      end if;
      insert into public.notifications (user_id, actor_id, type, community_thread_id, community_reply_id)
        select new_author, new.author_id, 'community_best_answer', new.id, new.best_reply_id
        where new_author is not null and new_author != new.author_id;
    end if;
  end if;
  return null;
end;
$$;

create trigger community_best_reply_points_trigger
  after update of best_reply_id on public.community_threads
  for each row execute function public.on_community_best_reply_points();
