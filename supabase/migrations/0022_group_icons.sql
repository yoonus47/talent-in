-- TalentZify — group icons.
-- Run this in the Supabase SQL editor after 0021_group_member_cap_100.sql.
--
-- Same shape as 0005_profile_upgrades.sql's avatars bucket (public read,
-- folder-scoped write), just folder-per-conversation instead of
-- folder-per-user, and gated on admin membership (is_conversation_admin,
-- 0020_fix_group_chat_rls_recursion.sql) instead of "your own folder".

alter table public.conversations add column icon_url text;

insert into storage.buckets (id, name, public)
values ('group-icons', 'group-icons', true)
on conflict (id) do nothing;

create policy "group icons are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'group-icons');

create policy "group admins can upload their group's icon"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'group-icons'
    and public.is_conversation_admin((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy "group admins can update their group's icon"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'group-icons'
    and public.is_conversation_admin((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy "group admins can delete their group's icon"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'group-icons'
    and public.is_conversation_admin((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- Same admin-only rename policy (0019_group_chats.sql) already covers
-- icon_url's row-level access (type='group' + is_conversation_admin) —
-- just extend the column-scoped grant to include it.
grant update (name, icon_url) on public.conversations to authenticated;
