-- TalentZify — real delivery receipts (the "sent -> delivered -> read"
-- ladder, not just sent-vs-read). Run this in the Supabase SQL editor
-- after 0028_community.sql.
--
-- Shaped identically to the existing conversation_reads
-- (0015_direct_messages.sql, group-RLS extended by 0019_group_chats.sql):
-- a per-(conversation, user) WATERMARK, not a per-message receipts row.
-- "Was message X delivered/read by user Y" is just `watermark >=
-- message.created_at` — the same comparison already used for "read" in
-- components/chat-thread.tsx's messageStatus — so a per-message "who's
-- seen this" breakdown (components/message-info-panel.tsx) falls out of
-- this for free, without an O(messages x members) table.

create table public.conversation_deliveries (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_delivered_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_deliveries enable row level security;

create policy "members can read delivery-markers"
  on public.conversation_deliveries for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "users can write their own delivery-marker"
  on public.conversation_deliveries for insert
  to authenticated
  with check (user_id = auth.uid() and public.is_conversation_member(conversation_id, auth.uid()));

create policy "users can update their own delivery-marker"
  on public.conversation_deliveries for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Required for postgres_changes subscriptions (live delivery-status
-- updates in components/chat-thread.tsx) to fire at all — same as
-- messages/conversation_reads already needed in 0015_direct_messages.sql.
alter publication supabase_realtime add table public.conversation_deliveries;
