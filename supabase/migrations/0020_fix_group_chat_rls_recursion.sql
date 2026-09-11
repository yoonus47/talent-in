-- TalentZify — hot-fix for 0019_group_chats.sql's RLS recursion bug.
-- Run this in the Supabase SQL editor after 0019_group_chats.sql.
--
-- 0019, as originally applied, had `conversation_members`' own select/
-- delete policies (and every policy on conversations/messages/
-- conversation_reads that checks membership) subquery conversation_members
-- directly. Querying an RLS-protected table from within its own policy —
-- or from another policy that then has to re-evaluate that table's policy
-- for the subquery — is a genuine infinite recursion in Postgres (error
-- 42P17, confirmed live: it broke reading/sending messages, renaming,
-- removing members, and leaving a group). This patch introduces two
-- SECURITY DEFINER helper functions (whose internal queries bypass RLS
-- entirely, same mechanism as get_daily_challenge/delete_own_account) and
-- repoints every affected policy at them instead. 0019_group_chats.sql in
-- the repo has been corrected in place to match — a fresh database running
-- migrations from scratch will never hit this bug; this file only exists
-- to patch a database that already ran the original, buggy 0019.

create or replace function public.is_conversation_member(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id
  );
$$;

create or replace function public.is_conversation_admin(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = p_user_id and role = 'admin'
  );
$$;

grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;
grant execute on function public.is_conversation_admin(uuid, uuid) to authenticated;

-- ── conversation_members ────────────────────────────────────────────────
drop policy "members can see fellow members of their conversations" on public.conversation_members;
drop policy "members can leave groups, admins can remove members" on public.conversation_members;

create policy "members can see fellow members of their conversations"
  on public.conversation_members for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "members can leave groups, admins can remove members"
  on public.conversation_members for delete
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_members.conversation_id and c.type = 'group'
    )
    and (user_id = auth.uid() or public.is_conversation_admin(conversation_id, auth.uid()))
  );

-- ── conversations ────────────────────────────────────────────────────────
drop policy "members can read their conversations" on public.conversations;
drop policy "group admins can rename their group" on public.conversations;

create policy "members can read their conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id, auth.uid()));

create policy "group admins can rename their group"
  on public.conversations for update
  to authenticated
  using (type = 'group' and public.is_conversation_admin(id, auth.uid()))
  with check (type = 'group' and name is not null and char_length(name) between 1 and 60);

-- ── messages ────────────────────────────────────────────────────────────
drop policy "members can read messages" on public.messages;
drop policy "members can send messages as themselves" on public.messages;

create policy "members can read messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "members can send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id, auth.uid()));

-- ── conversation_reads ──────────────────────────────────────────────────
drop policy "members can read read-markers" on public.conversation_reads;

create policy "members can read read-markers"
  on public.conversation_reads for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
