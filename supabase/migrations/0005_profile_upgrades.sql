-- TalentZify — real first/last names, avatar upload, self-service account deletion.
-- Run this in the Supabase SQL editor after 0004_social_network.sql.

-- ── profiles.first_name / last_name ────────────────────────────────────
-- full_name stays the single source of truth for display everywhere; these
-- are additive, structured columns so onboarding/settings can ask for and
-- edit a real name instead of silently trusting whatever the OAuth
-- provider happened to supply.
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;

-- Best-effort backfill for existing rows (splits on the first space).
update public.profiles
set
  first_name = coalesce(first_name, split_part(full_name, ' ', 1)),
  last_name = coalesce(
    last_name,
    nullif(trim(regexp_replace(full_name, '^\S+\s*', '')), '')
  )
where first_name is null or last_name is null;

-- ── avatars storage bucket ──────────────────────────────────────────────
-- Public read (profile pictures are meant to be visible), folder-per-user
-- ownership so write access can be scoped to "your own folder only".
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── delete_own_account() ───────────────────────────────────────────────
-- Lets a user delete their own account without exposing the service-role
-- key to the app's runtime. profiles.id references auth.users(id) on
-- delete cascade, and every other table cascades from profiles.id, so
-- this one delete removes the account and everything it owns (posts,
-- comments, reactions, shares, follows, notifications, quiz results,
-- challenge attempts) in a single statement.
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

grant execute on function public.delete_own_account() to authenticated;
