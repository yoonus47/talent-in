-- TalentZify — user blocking. Symmetric and mutual: once a block exists
-- between A and B, neither can follow, DM, or view the other's profile,
-- and any existing mutual follow is removed automatically. Group chats
-- are unaffected — forcibly removing someone from every shared group on
-- block is a bigger, more surprising side effect than this v1 needs.

-- ── blocks ────────────────────────────────────────────────────────────
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

-- Privacy-critical: nobody, including the blocked person, can ever see
-- who blocked them. Only the blocker's own rows are visible to them at
-- all — same posture as user_safety_summary (0034) and every other
-- sensitive relation in this schema.
create policy "users can see who they've blocked"
  on public.blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

create policy "users can block as themselves"
  on public.blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);

create policy "users can unblock as themselves"
  on public.blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

-- ── helper functions ─────────────────────────────────────────────────
-- security definer + stable, same shape as is_conversation_member
-- (0020_fix_group_chat_rls_recursion.sql) — lets RLS policies elsewhere
-- check block status without needing their own select grant on `blocks`
-- (which, per the policy above, only the blocker themselves ever has).
create or replace function public.users_blocked_each_other(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

grant execute on function public.users_blocked_each_other(uuid, uuid) to authenticated;

-- False for group conversations on purpose (see the header comment) —
-- only a `type = 'dm'` conversation's two fixed parties are checked.
create or replace function public.dm_conversation_blocked(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select public.users_blocked_each_other(c.user_a_id, c.user_b_id)
      from public.conversations c
      where c.id = p_conversation_id and c.type = 'dm'
    ),
    false
  );
$$;

grant execute on function public.dm_conversation_blocked(uuid) to authenticated;

-- Ids to exclude from Discover/search/suggestions for the *calling* user
-- specifically (always auth.uid(), no parameter — never queryable for
-- anyone else). Union of both directions: a caller can already list who
-- they've blocked directly (the select policy above allows that), but
-- not who's blocked them, so this is the only way to also filter those
-- out without adding a select policy that would leak that reverse
-- direction. Safe to expose as a plain id set: seeing that someone is
-- missing from a filtered list never reveals *which* direction the block
-- is, or that one exists at all, versus any other reason they didn't match.
create or replace function public.blocked_user_ids()
returns table (user_id uuid)
language sql
security definer
set search_path = public
stable
as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;

grant execute on function public.blocked_user_ids() to authenticated;

-- ── auto-unfollow on block ───────────────────────────────────────────
-- start_dm_conversation (0019_group_chats.sql) already requires mutual
-- follow to create or reuse a DM conversation, so removing the follow
-- here already closes off any *new* DM between blocked parties with no
-- further changes — the messages policy below only has to handle an
-- *existing* conversation.
create or replace function public.unfollow_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

create trigger unfollow_on_block
  after insert on public.blocks
  for each row execute function public.unfollow_on_block();

-- ── close the gaps: follows + messages ──────────────────────────────
-- Defense in depth alongside the app-level checks in lib/actions/
-- block.ts and lib/actions/profile.ts's toggleFollow — RLS is the real
-- boundary here, same posture this schema uses throughout.
drop policy "users can follow as themselves" on public.follows;

create policy "users can follow as themselves"
  on public.follows for insert
  to authenticated
  with check (
    auth.uid() = follower_id
    and not public.users_blocked_each_other(follower_id, following_id)
  );

drop policy "members can send messages as themselves" on public.messages;

create policy "members can send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id, auth.uid())
    and not public.dm_conversation_blocked(conversation_id)
  );
