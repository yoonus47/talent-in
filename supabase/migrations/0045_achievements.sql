-- Self-added accomplishments (competition wins, school honors, completed
-- certificates) — the "proof of what I've done" piece Skills (just tags)
-- doesn't cover. Its own table, not another profiles column: each entry
-- has several fields (title, issuer, date, optional description/link/
-- photo), unlike Skills' flat tag list.
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Two-way split, not a bigger category set, so the add form stays one
  -- toggle, not a dropdown — covers everything from a science-fair medal
  -- to a Coursera completion, and drives which icon renders on the profile.
  kind text not null default 'achievement' check (kind in ('achievement', 'certificate')),
  title text not null,
  issuer text,
  -- Month/year only in the UI (<input type="month">, stored as day 01) —
  -- nobody needs to specify which day they won a competition.
  earned_on date,
  description text,
  credential_url text,
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists achievements_user_id_earned_on_idx
  on public.achievements (user_id, earned_on desc);

alter table public.achievements enable row level security;

-- Matches profiles' own posture (0001_init.sql: "profiles are readable by
-- authenticated users", using (true)) — this app has no privacy/follow-
-- gating anywhere, achievements shouldn't invent a stricter model.
create policy "achievements are readable by authenticated users"
  on public.achievements for select to authenticated using (true);

create policy "users can add their own achievements"
  on public.achievements for insert to authenticated
  with check (auth.uid() = user_id);

create policy "users can update their own achievements"
  on public.achievements for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users can delete their own achievements"
  on public.achievements for delete to authenticated
  using (auth.uid() = user_id);

-- No explicit Data API grant needed here — 0044_data_api_grants.sql's
-- `alter default privileges in schema public grant ... on tables to
-- anon, authenticated` already covers any table created after it by the
-- same migration role, this one included. Verify that's actually true
-- live (a real authenticated insert/select), not just assumed.
