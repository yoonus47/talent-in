-- TalentZify — clean up storage on account deletion.
-- Run this in the Supabase SQL editor after 0005_profile_upgrades.sql.
--
-- Found via live testing: deleting an account correctly removed the
-- auth.users row (and everything that cascades from profiles.id), but
-- storage objects aren't tied to Postgres foreign keys, so the avatar
-- file was left behind, orphaned under a folder named for a user id that
-- no longer exists. This patches delete_own_account() to remove it first.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text;

  delete from auth.users where id = auth.uid();
end;
$$;
