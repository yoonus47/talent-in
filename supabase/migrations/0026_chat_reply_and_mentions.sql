-- TalentZify — reply-to-message + @mention/@all in group chats.
-- Run this in the Supabase SQL editor after 0025_platform_tracking.sql.
--
-- Adds a reply "quote" snapshot and a mentioned-user-ids list to `messages`.
-- Both are populated by a BEFORE INSERT trigger, not trusted from the
-- client — messages never got the column-grant restriction conversations/
-- profiles did (a client can set any column on its own insert), so if the
-- reply snapshot or mentioned_user_ids were taken as-sent, a client could
-- fabricate a quote block attributing invented text to anyone, or notify
-- someone who isn't even a member of the conversation. The trigger
-- recomputes both from the real, authoritative data server-side; the
-- client's insert only needs to send reply_to_id and a raw
-- mentioned_user_ids guess — everything else about them is overwritten.

alter table public.messages
  add column reply_to_id uuid references public.messages(id) on delete set null,
  -- No FK here, deliberately — see reply_to_sender_name below.
  add column reply_to_sender_id uuid,
  -- Denormalized snapshot of the replied-to sender's name at reply time —
  -- not a live join. This also has to have no FK/cascade tying it back to
  -- profiles: messages.sender_id cascades on profile deletion (0015), so a
  -- deleted user's own messages vanish outright, but messages replying TO
  -- them must survive (matching reply_to_id's own "on delete set null").
  -- If reply_to_sender_id instead referenced profiles(id) on delete set
  -- null, deleting that profile would null reply_to_sender_id alone while
  -- reply_to_sender_name/reply_to_type stayed populated, violating the
  -- all-or-nothing check below and hard-failing delete_own_account for
  -- anyone who was ever replied to. Same reasoning comments.mentioned_user_ids
  -- already uses (0010) — no FK there either.
  add column reply_to_sender_name text,
  add column reply_to_type text check (reply_to_type in ('text', 'voice')),
  add column reply_to_preview text check (reply_to_preview is null or char_length(reply_to_preview) <= 120),
  -- Mirrors comments.mentioned_user_ids exactly (0010_comment_threads_and_reactions.sql)
  -- — no FK, presentation-time-only, never cross-referenced when rendering
  -- (see components/message-text.tsx).
  add column mentioned_user_ids uuid[] not null default '{}';

-- All four snapshot columns travel together — reply_to_id can independently
-- null out later (its own on-delete-set-null, when the original is
-- unsent), which just disables "jump to original" while the quote block
-- itself keeps rendering from the snapshot.
alter table public.messages add constraint messages_reply_snapshot_check check (
  (reply_to_sender_id is null and reply_to_sender_name is null and reply_to_type is null)
  or
  (reply_to_sender_id is not null and reply_to_sender_name is not null and reply_to_type is not null)
);

create or replace function public.set_message_reply_and_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reply public.messages%rowtype;
begin
  -- Reply snapshot: look up reply_to_id scoped to the SAME conversation
  -- (so you can't quote a message from a conversation you're not even in)
  -- and overwrite whatever the client sent for the snapshot columns.
  if new.reply_to_id is not null then
    select * into v_reply from public.messages
    where id = new.reply_to_id and conversation_id = new.conversation_id;
  end if;

  if v_reply.id is null then
    new.reply_to_id := null;
    new.reply_to_sender_id := null;
    new.reply_to_sender_name := null;
    new.reply_to_type := null;
    new.reply_to_preview := null;
  else
    new.reply_to_sender_id := v_reply.sender_id;
    select full_name into new.reply_to_sender_name from public.profiles where id = v_reply.sender_id;
    new.reply_to_type := v_reply.type;
    new.reply_to_preview := case when v_reply.type = 'text' then left(v_reply.content, 120) else null end;
  end if;

  -- Mentions: filter down to actual current members of THIS conversation,
  -- minus the sender themselves — is_conversation_member is the existing
  -- SECURITY DEFINER helper from 0019_group_chats.sql, reused rather than
  -- a raw subquery on conversation_members (a raw subquery inside a
  -- conversation_members-adjacent RLS/trigger context is what caused the
  -- real 42P17 infinite-recursion bug fixed in 0020).
  if array_length(new.mentioned_user_ids, 1) > 0 then
    select coalesce(array_agg(distinct uid), '{}') into new.mentioned_user_ids
    from unnest(new.mentioned_user_ids) as uid
    where uid <> new.sender_id and public.is_conversation_member(new.conversation_id, uid);
  end if;

  return new;
end;
$$;

create trigger set_message_reply_and_mentions_trigger
  before insert on public.messages
  for each row execute function public.set_message_reply_and_mentions();

-- No RLS/GRANT changes needed below this line — these new columns ride
-- the existing "members can send messages as themselves" INSERT policy
-- (0019_group_chats.sql) exactly like type/audio_url/duration_ms needed no
-- grant in 0023_voice_messages.sql; messages.Update stays "never" (client
-- never updates a message, only inserts/deletes), so there's nothing for a
-- client-writable UPDATE grant to even protect here.
