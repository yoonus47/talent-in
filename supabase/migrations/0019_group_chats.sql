-- TalentZify — group chats.
-- Run this in the Supabase SQL editor after 0018_word_pronunciation.sql.
--
-- Generalizes `conversations` (previously DM-only) to also hold groups, and
-- introduces `conversation_members` as the single source of truth for
-- membership on BOTH kinds — every RLS check in this file (on conversations,
-- messages, conversation_reads, and conversation_members itself) keys off
-- membership instead of the old `user_a_id`/`user_b_id` pair check. Creation
-- moves entirely into SECURITY DEFINER RPCs at the bottom (same pattern as
-- get_daily_challenge/delete_own_account) — there is deliberately no
-- authenticated-role INSERT policy left on `conversations` or
-- `conversation_members`, so a conversation can never exist without matching
-- membership rows.
--
-- Statement order matters: conversation_members is created and backfilled
-- from existing DMs *before* any RLS policy is switched over to it, so
-- existing conversations are never briefly inaccessible mid-migration.

-- ── conversations: add the type discriminator ──────────────────────────
alter table public.conversations
  add column type text not null default 'dm' check (type in ('dm', 'group')),
  add column name text,
  add column created_by uuid references public.profiles(id) on delete set null,
  alter column user_a_id drop not null,
  alter column user_b_id drop not null;

-- Two valid shapes only: a dm row keeps both participant columns and no
-- name; a group row has neither participant column and a name. The
-- existing `check (user_a_id < user_b_id)` and `unique (user_a_id,
-- user_b_id)` constraints are unaffected by group rows — Postgres treats a
-- NULL-valued CHECK expression as satisfying the constraint, and SQL NULLs
-- never collide in a UNIQUE constraint — so no changes needed there.
alter table public.conversations add constraint conversations_shape_check check (
  (type = 'dm' and user_a_id is not null and user_b_id is not null and name is null)
  or
  (type = 'group' and user_a_id is null and user_b_id is null
   and name is not null and char_length(name) between 1 and 60)
);

-- ── conversation_members ────────────────────────────────────────────────
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- Serves getConversations()'s "find all my conversation ids" reverse
-- lookup — the primary key alone only serves per-conversation checks.
create index conversation_members_user_id_idx on public.conversation_members (user_id);

-- Backfill: every existing DM gets its two membership rows. 'member' for
-- both sides — role only matters for group admin actions, so there's no
-- meaningful "admin" for a DM pair.
insert into public.conversation_members (conversation_id, user_id, role)
select id, user_a_id, 'member' from public.conversations where type = 'dm'
union all
select id, user_b_id, 'member' from public.conversations where type = 'dm'
on conflict do nothing;

alter table public.conversation_members enable row level security;

-- Every membership check in this file — including conversation_members'
-- OWN select/delete policies below — needs to ask "is this user a member
-- of this conversation" without querying conversation_members directly
-- through a normal (RLS-subject) subquery: doing that from *within*
-- conversation_members' own policy is a real infinite recursion (Postgres
-- error 42P17, confirmed live) — evaluating the policy requires running
-- the subquery, which is itself gated by the same policy, forever. The
-- fix is the standard one for self-referencing membership tables: a
-- SECURITY DEFINER function, whose internal query bypasses RLS entirely
-- (it runs as the function's owner, same mechanism as get_daily_challenge/
-- delete_own_account), breaking the cycle. Every policy below — on
-- conversation_members itself, and on conversations/messages/
-- conversation_reads — calls one of these instead of subquerying
-- conversation_members inline.
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

create policy "members can see fellow members of their conversations"
  on public.conversation_members for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

-- Covers both "leave group" (self) and "admin removes a member" in one
-- policy. Scoped to type='group' only — DM membership rows must never be
-- deletable this way (start_dm_conversation's self-healing upsert below
-- relies on a DM's membership rows only ever being written once).
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

-- No INSERT policy at all — only the SECURITY DEFINER RPCs below ever
-- create membership rows (they bypass RLS entirely as the function owner).

-- A group is never permanently admin-less just because its last admin
-- left: promote the earliest-joined remaining member automatically. Must
-- be SECURITY DEFINER — a trigger runs as the invoking role (the leaving
-- member or a removing admin), and neither has an UPDATE policy on a
-- *different* member's role.
create or replace function public.promote_next_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and not exists (
    select 1 from public.conversation_members
    where conversation_id = old.conversation_id and role = 'admin'
  ) then
    update public.conversation_members
    set role = 'admin'
    where conversation_id = old.conversation_id
      and user_id = (
        select user_id from public.conversation_members
        where conversation_id = old.conversation_id
        order by joined_at asc
        limit 1
      );
  end if;
  return old;
end;
$$;

create trigger promote_next_admin_trigger
  after delete on public.conversation_members
  for each row execute function public.promote_next_admin();

-- ── conversations: swap RLS over to membership ──────────────────────────
drop policy "participants can read their conversations" on public.conversations;
drop policy "mutual follows can start a conversation" on public.conversations;

create policy "members can read their conversations"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_member(id, auth.uid()));

-- No INSERT policy — dm and group creation both go through the RPCs below.

create policy "group admins can rename their group"
  on public.conversations for update
  to authenticated
  using (type = 'group' and public.is_conversation_admin(id, auth.uid()))
  with check (type = 'group' and name is not null and char_length(name) between 1 and 60);

-- Column-scoped: revoke the table-wide UPDATE grant Supabase's default
-- privileges hand out (a plain `grant update (name)` on its own wouldn't
-- narrow anything — Postgres unions column- and table-level grants — so
-- the revoke first is what actually makes `name` the only writable
-- column here; no other code path updates conversations today).
revoke update on public.conversations from authenticated;
grant update (name) on public.conversations to authenticated;

-- ── messages: swap RLS over to membership ───────────────────────────────
drop policy "participants can read messages" on public.messages;
drop policy "participants can send messages as themselves" on public.messages;

create policy "members can read messages"
  on public.messages for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

create policy "members can send messages as themselves"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id, auth.uid()));

-- "senders can unsend their own messages" (delete policy) is unchanged —
-- sender_id = auth.uid() is enough regardless of dm/group.

-- ── conversation_reads: swap RLS over to membership ─────────────────────
drop policy "participants can read read-markers" on public.conversation_reads;

create policy "members can read read-markers"
  on public.conversation_reads for select
  to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

-- insert/update "own read-marker" policies are unchanged — user_id =
-- auth.uid() already doesn't care about dm vs group.

-- ── notifications: new group_added type + conversation link ────────────
alter table public.notifications
  add column conversation_id uuid references public.conversations(id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'follow', 'reaction', 'comment', 'share', 'reply', 'mention', 'comment_reaction', 'group_added'
  ));

-- ── RPCs ─────────────────────────────────────────────────────────────────

-- Replaces the multi-query find-or-create logic previously duplicated in
-- lib/actions/chat.ts's startConversation. Unconditionally upserts both
-- membership rows regardless of found-vs-created, as cheap self-healing
-- insurance — a dm conversation can never end up existing without its
-- membership rows.
create or replace function public.start_dm_conversation(p_other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if p_other_id = v_me then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  if not exists (
    select 1 from public.follows where follower_id = v_me and following_id = p_other_id
  ) or not exists (
    select 1 from public.follows where follower_id = p_other_id and following_id = v_me
  ) then
    raise exception 'Both users must follow each other';
  end if;

  if v_me < p_other_id then
    v_a := v_me;
    v_b := p_other_id;
  else
    v_a := p_other_id;
    v_b := v_me;
  end if;

  select id into v_id from public.conversations
  where type = 'dm' and user_a_id = v_a and user_b_id = v_b;

  if v_id is null then
    insert into public.conversations (type, user_a_id, user_b_id)
    values ('dm', v_a, v_b)
    returning id into v_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_id, v_a), (v_id, v_b)
  on conflict do nothing;

  return v_id;
end;
$$;

grant execute on function public.start_dm_conversation(uuid) to authenticated;

-- p_member_ids must not include the caller (excluded automatically) or be
-- empty after that exclusion — a "group" needs at least one other person,
-- which combined with the mutual-follow check below means a real minimum
-- of 3 total participants in practice. Every member must be mutually
-- followed with the caller (both directions) — any failure rolls back the
-- whole call, so a group is never left half-created.
create or replace function public.create_group_conversation(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_name text := trim(p_name);
  v_member_ids uuid[];
  v_id uuid;
  v_member_id uuid;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;
  if v_name = '' or char_length(v_name) > 60 then
    raise exception 'Group name must be 1-60 characters';
  end if;

  select array_agg(distinct member_id) into v_member_ids
  from unnest(p_member_ids) as member_id
  where member_id <> v_me;

  if v_member_ids is null or array_length(v_member_ids, 1) = 0 then
    raise exception 'A group needs at least one other member';
  end if;
  if array_length(v_member_ids, 1) + 1 > 100 then
    raise exception 'Groups are capped at 100 members';
  end if;

  foreach v_member_id in array v_member_ids loop
    if not exists (
      select 1 from public.follows where follower_id = v_me and following_id = v_member_id
    ) or not exists (
      select 1 from public.follows where follower_id = v_member_id and following_id = v_me
    ) then
      raise exception 'You can only add people you mutually follow';
    end if;
  end loop;

  insert into public.conversations (type, name, created_by)
  values ('group', v_name, v_me)
  returning id into v_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_id, v_me, 'admin');

  insert into public.conversation_members (conversation_id, user_id, role)
  select v_id, member_id, 'member' from unnest(v_member_ids) as member_id;

  insert into public.notifications (user_id, actor_id, type, conversation_id)
  select member_id, v_me, 'group_added', v_id from unnest(v_member_ids) as member_id;

  return v_id;
end;
$$;

grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

-- Admin-only. Same mutual-follow trust boundary as group creation — you
-- can only add people YOU mutually follow (not someone who merely follows
-- an existing member), consistent with 0015's "mutual-follow only checked
-- at creation time" philosophy for dms.
create or replace function public.add_group_members(p_conversation_id uuid, p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_member_ids uuid[];
  v_member_id uuid;
  v_new_count int;
  v_existing_count int;
begin
  if v_me is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and user_id = v_me and role = 'admin'
  ) then
    raise exception 'Only group admins can add members';
  end if;
  if not exists (select 1 from public.conversations where id = p_conversation_id and type = 'group') then
    raise exception 'Not a group conversation';
  end if;

  select array_agg(distinct member_id) into v_member_ids
  from unnest(p_member_ids) as member_id
  where member_id <> v_me
    and not exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = p_conversation_id and cm.user_id = member_id
    );

  if v_member_ids is null or array_length(v_member_ids, 1) = 0 then
    return;
  end if;

  foreach v_member_id in array v_member_ids loop
    if not exists (
      select 1 from public.follows where follower_id = v_me and following_id = v_member_id
    ) or not exists (
      select 1 from public.follows where follower_id = v_member_id and following_id = v_me
    ) then
      raise exception 'You can only add people you mutually follow';
    end if;
  end loop;

  select count(*) into v_existing_count
  from public.conversation_members where conversation_id = p_conversation_id;

  v_new_count := array_length(v_member_ids, 1);
  if v_existing_count + v_new_count > 100 then
    raise exception 'Groups are capped at 100 members';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  select p_conversation_id, member_id, 'member' from unnest(v_member_ids) as member_id
  on conflict do nothing;

  insert into public.notifications (user_id, actor_id, type, conversation_id)
  select member_id, v_me, 'group_added', p_conversation_id from unnest(v_member_ids) as member_id;
end;
$$;

grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;
