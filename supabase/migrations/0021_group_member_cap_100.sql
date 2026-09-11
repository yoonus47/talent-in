-- TalentZify — raise the group member cap from 50 to 100.
-- Run this in the Supabase SQL editor after 0020_fix_group_chat_rls_recursion.sql.
--
-- Just the two cap checks in create_group_conversation/add_group_members
-- (0019_group_chats.sql) — everything else about those functions is
-- unchanged. create or replace, so this is a plain in-place swap.

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
