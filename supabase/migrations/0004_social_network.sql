-- Talent In — notifications for the social graph (follow, react, comment, share).
-- Run this in the Supabase SQL editor after 0003_reactions_and_avatars.sql.
-- No schema change needed for people discovery — `profiles` already has
-- enough columns (grade, school, city, interests) to search/filter/suggest.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('follow', 'reaction', 'comment', 'share')),
  post_id uuid references public.posts(id) on delete cascade,
  reaction_type text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "users can read their own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

-- Any authenticated user can create a notification *as themselves* for any
-- recipient — this is how "notify the other person" works without a
-- service-role function: the insert happens inside the actor's own already
-- authenticated server action (see lib/notify.ts).
create policy "users can create notifications as themselves"
  on public.notifications for insert
  to authenticated
  with check (auth.uid() = actor_id);

create policy "users can mark their own notifications read"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
