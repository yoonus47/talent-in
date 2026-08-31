-- TalentZify — revert the broken storage cleanup from 0006.
-- Run this in the Supabase SQL editor after 0006_delete_avatar_on_account_delete.sql.
--
-- Found via live testing: Supabase blocks direct SQL DELETE against
-- storage.objects entirely ("Direct deletion from storage tables is not
-- allowed. Use the Storage API instead"), even from a SECURITY DEFINER
-- function. 0006's version of this function therefore fails outright for
-- any account that has an avatar uploaded -- a live regression, since it
-- errors out before ever reaching the auth.users delete. Reverting the
-- function to just the auth.users delete; avatar cleanup now happens in
-- the app layer (lib/actions/profile.ts's deleteAccount) via the actual
-- Storage API, before this RPC is called.
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

  delete from auth.users where id = auth.uid();
end;
$$;
