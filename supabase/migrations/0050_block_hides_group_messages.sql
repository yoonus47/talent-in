-- TalentZify — extends 0048_user_blocking.sql's block into shared group
-- chats: a blocked relationship now hides each other's messages within
-- any group both are still members of. Deliberately the lightest of the
-- three options considered — group membership is untouched (nobody's
-- removed, other members see everything as normal) and the blocked
-- person can still send into the group (other members still see those
-- messages); only the blocked pair stop seeing *each other's* messages
-- there. DMs are unchanged: an existing DM conversation's history still
-- stays visible after a block (only *new* DM messages are refused, via
-- dm_conversation_blocked, already in 0048) — this migration only adds
-- new behavior for group conversations.
--
-- This is a SELECT-time hide (RLS), not a send-time refusal — the
-- messages insert policy is untouched, so a blocked pair can still post
-- into a shared group. It rides the same RLS-gates-postgres_changes
-- mechanism components/chat-thread.tsx's realtime subscription already
-- depends on (see that file's own comment on why `realtime.setAuth` is
-- required), so hidden messages disappear from both the initial load
-- *and* realtime with no client-side filtering code needed anywhere.

-- False for DMs and for a message with no block relationship — only
-- true when this specific message's sender and the viewer (auth.uid())
-- have blocked each other AND the conversation is a group.
create or replace function public.group_message_blocked(p_conversation_id uuid, p_sender_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select public.users_blocked_each_other(p_sender_id, auth.uid())
      from public.conversations c
      where c.id = p_conversation_id and c.type = 'group'
    ),
    false
  );
$$;

grant execute on function public.group_message_blocked(uuid, uuid) to authenticated;

drop policy "members can read messages" on public.messages;

create policy "members can read messages"
  on public.messages for select
  to authenticated
  using (
    public.is_conversation_member(conversation_id, auth.uid())
    and not public.group_message_blocked(conversation_id, sender_id)
  );
