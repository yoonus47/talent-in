-- Talent In — LinkedIn-style reactions (our own set, not a copy).
-- Run this in the Supabase SQL editor after 0002_dashboard_and_share.sql.

-- `likes` becomes `reactions`: each user still has at most one reaction per
-- post (same unique (post_id, user_id) pair as before), but now picks a
-- type instead of a plain boolean. Existing rows default to 'fire'.
alter table public.likes rename to reactions;

alter table public.reactions
  add column if not exists reaction_type text not null default 'fire'
  check (reaction_type in ('fire', 'cheers', 'smart', 'respect'));

-- Switching reaction type (e.g. fire -> cheers) is an update, not a
-- delete+insert — needs its own policy (insert/delete policies already
-- carried over from `likes`).
create policy "users can change their own reaction"
  on public.reactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
