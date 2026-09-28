-- TalentZify — basic anti-abuse rate limits on the three write paths with
-- no throttle at all today: posting, following, and messaging. Enforced
-- as BEFORE INSERT triggers, not just app-side checks — messages in
-- particular are inserted directly from the client
-- (components/chat-thread.tsx, no server action in that path), so a
-- trigger is the only place that actually covers every write.
--
-- Each raised message is prefixed "RATE_LIMITED:" so app code can detect
-- it (vs. any other DB error) without string-matching human-facing copy —
-- see lib/actions/posts.ts's createPost and components/chat-thread.tsx
-- for where that prefix gets caught and turned into a real message.

-- ── posts: 5 per 10 minutes ─────────────────────────────────────────
create or replace function public.check_post_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.posts
    where user_id = new.user_id and created_at > now() - interval '10 minutes'
  ) >= 5 then
    raise exception 'RATE_LIMITED: You are posting too fast. Wait a few minutes and try again.';
  end if;
  return new;
end;
$$;

create trigger check_post_rate_limit
  before insert on public.posts
  for each row execute function public.check_post_rate_limit();

-- ── follows: 30 per hour ─────────────────────────────────────────────
create or replace function public.check_follow_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.follows
    where follower_id = new.follower_id and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'RATE_LIMITED: You are following too many people too fast. Try again later.';
  end if;
  return new;
end;
$$;

create trigger check_follow_rate_limit
  before insert on public.follows
  for each row execute function public.check_follow_rate_limit();

-- ── messages: 20 per minute ──────────────────────────────────────────
-- Same table for text and voice messages (the `type` column tells them
-- apart) — one trigger covers both.
create or replace function public.check_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(*) from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '1 minute'
  ) >= 20 then
    raise exception 'RATE_LIMITED: You are sending messages too fast. Wait a moment and try again.';
  end if;
  return new;
end;
$$;

create trigger check_message_rate_limit
  before insert on public.messages
  for each row execute function public.check_message_rate_limit();
