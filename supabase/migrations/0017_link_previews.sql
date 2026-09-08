-- TalentZify — link preview cards (Twitter/Discord/Slack-style unfurls).
-- A shared cache keyed by URL, not owned by any post or user — nobody
-- "owns" a URL's preview, so this doesn't need per-row ownership the way
-- posts/comments/etc. do. Populated live by the app (lib/actions/
-- link-preview.ts), not a seed script, so (unlike vocabulary_words) it
-- needs write access too, not just read.
-- Run this in the Supabase SQL editor after 0016_realtime_notifications.sql.

create table public.link_previews (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  status text not null check (status in ('ok', 'failed')),
  title text,
  description text,
  image_url text,
  site_name text,
  fetched_at timestamptz not null default now()
);

alter table public.link_previews enable row level security;

create policy "link previews are readable by authenticated users"
  on public.link_previews for select
  to authenticated
  using (true);

create policy "authenticated users can write link preview cache entries"
  on public.link_previews for insert
  to authenticated
  with check (true);

create policy "authenticated users can refresh link preview cache entries"
  on public.link_previews for update
  to authenticated
  using (true)
  with check (true);

-- No delete policy — a stale/orphaned cache row (e.g. every post linking a
-- URL gets deleted) costs a few bytes of text, nothing worth cleaning up,
-- unlike the Storage-file cleanup avatars/post-images need.
