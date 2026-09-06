-- TalentZify — direct messages (1:1 chat).
-- Run this in the Supabase SQL editor after 0014_vocabulary.sql.
--
-- DMs require a mutual follow (both directions in `follows`) — enforced by
-- the `conversations` insert policy below, not just hidden in the UI. Once
-- a conversation exists it keeps working even if one side later unfollows;
-- mutual-follow is only checked at creation time.

-- ── conversations ───────────────────────────────────────────────────────
-- One row per pair of students. `user_a_id`/`user_b_id` are canonically
-- ordered (user_a_id < user_b_id) by the app — see startConversation in
-- lib/actions/chat.ts — so a pair only ever gets one row regardless of who
-- starts it.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles(id) on delete cascade,
  user_b_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a_id < user_b_id),
  unique (user_a_id, user_b_id)
);

alter table public.conversations enable row level security;

create policy "participants can read their conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid() in (user_a_id, user_b_id));

create policy "mutual follows can start a conversation"
  on public.conversations for insert
  to authenticated
  with check (
    auth.uid() in (user_a_id, user_b_id)
    and exists (
      select 1 from public.follows f
      where f.follower_id = user_a_id and f.following_id = user_b_id
    )
    and exists (
      select 1 from public.follows f
      where f.follower_id = user_b_id and f.following_id = user_a_id
    )
  );

-- No update/delete policy — a conversation, once created, exists forever
-- (same as comments/shares not being archivable).

-- ── messages ────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

create policy "participants can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and auth.uid() in (c.user_a_id, c.user_b_id)
    )
  );

create policy "participants can send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and auth.uid() in (c.user_a_id, c.user_b_id)
    )
  );

create policy "senders can unsend their own messages"
  on public.messages for delete
  to authenticated
  using (sender_id = auth.uid());

-- ── conversation_reads ──────────────────────────────────────────────────
-- One row per (conversation, user) — drives both the unread badge and the
-- "Seen" indicator. Either participant can read both rows (needed to show
-- "Seen"), but each user can only ever write their own.
create table if not exists public.conversation_reads (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;

create policy "participants can read read-markers"
  on public.conversation_reads for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_reads.conversation_id
        and auth.uid() in (c.user_a_id, c.user_b_id)
    )
  );

create policy "users can write their own read-marker"
  on public.conversation_reads for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update their own read-marker"
  on public.conversation_reads for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── realtime ────────────────────────────────────────────────────────────
-- Required for postgres_changes subscriptions (live message delivery, live
-- "Seen" updates) to fire at all. If this errors because the publication is
-- set up differently on this project, toggle it on instead via the
-- Supabase dashboard: Database → Replication.
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversation_reads;
