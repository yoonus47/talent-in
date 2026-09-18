-- TalentZify — Community round 2: reactions, reply mentions, per-thread
-- unread tracking, and the notification plumbing all three need. Run this
-- in the Supabase SQL editor after 0029_delivery_receipts.sql.
--
-- Fills in three of 0028_community.sql's own documented v1 cuts ("no
-- reactions on threads/replies", implicitly "no mentions" since replies
-- never got comments.mentioned_user_ids' sibling column, "no notifications
-- for new replies") — every shape here is a direct mirror of an existing
-- table, not a new pattern: community_thread_reactions/
-- community_reply_reactions copy comment_reactions (0010) exactly,
-- community_thread_reads copies conversation_reads (0015) minus the
-- multi-participant RLS (community has no membership concept to check —
-- every authenticated user can already read every thread).

-- ── community_thread_reactions ──────────────────────────────────────────
create table public.community_thread_reactions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('heart', 'fire', 'cheers', 'smart', 'respect')),
  created_at timestamptz not null default now(),
  unique (thread_id, user_id)
);

create index community_thread_reactions_thread_id_idx on public.community_thread_reactions (thread_id);

alter table public.community_thread_reactions enable row level security;

create policy "community thread reactions are readable by authenticated users"
  on public.community_thread_reactions for select
  to authenticated
  using (true);

create policy "users can react to threads as themselves"
  on public.community_thread_reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can change their own thread reaction"
  on public.community_thread_reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can remove their own thread reaction"
  on public.community_thread_reactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── community_reply_reactions ───────────────────────────────────────────
create table public.community_reply_reactions (
  id uuid primary key default gen_random_uuid(),
  reply_id uuid not null references public.community_replies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reaction_type text not null check (reaction_type in ('heart', 'fire', 'cheers', 'smart', 'respect')),
  created_at timestamptz not null default now(),
  unique (reply_id, user_id)
);

create index community_reply_reactions_reply_id_idx on public.community_reply_reactions (reply_id);

alter table public.community_reply_reactions enable row level security;

create policy "community reply reactions are readable by authenticated users"
  on public.community_reply_reactions for select
  to authenticated
  using (true);

create policy "users can react to replies as themselves"
  on public.community_reply_reactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can change their own reply reaction"
  on public.community_reply_reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can remove their own reply reaction"
  on public.community_reply_reactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── @mentions in replies ────────────────────────────────────────────────
-- Same "captured at write time from the autocomplete's actual selections,
-- never read back for display" contract as comments.mentioned_user_ids
-- (0010) — rendering "@username" is a pure regex over `content`.
alter table public.community_replies
  add column if not exists mentioned_user_ids uuid[] not null default '{}';

-- ── community_thread_reads ──────────────────────────────────────────────
-- One row per (thread, user) — a personal "last viewed" watermark that
-- powers the unread dot on the thread list. Simpler RLS than conversation_
-- reads' (0015): community has no participant list to check membership
-- against, so a user only ever needs to read their own watermark, never
-- someone else's (this isn't a "seen by" feature, just a personal marker).
create table public.community_thread_reads (
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_viewed_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.community_thread_reads enable row level security;

create policy "users can read their own thread watermark"
  on public.community_thread_reads for select
  to authenticated
  using (user_id = auth.uid());

create policy "users can write their own thread watermark"
  on public.community_thread_reads for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update their own thread watermark"
  on public.community_thread_reads for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── notifications: community_reply / community_reaction / community_mention ──
-- community_reaction covers BOTH a thread reaction and a reply reaction —
-- disambiguated at render time by which of the two new reference columns
-- is set, the same way the existing `mention` type already branches on
-- whether `conversation_id` is set (chat) or not (a feed comment).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'follow', 'reaction', 'comment', 'share', 'reply', 'mention', 'comment_reaction',
    'group_added', 'community_reply', 'community_reaction', 'community_mention'
  ));

alter table public.notifications
  add column if not exists community_thread_id uuid references public.community_threads(id) on delete cascade;
alter table public.notifications
  add column if not exists community_reply_id uuid references public.community_replies(id) on delete cascade;
