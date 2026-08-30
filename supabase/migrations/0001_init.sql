-- TalentZify — initial schema
-- Run this in the Supabase SQL editor, or via `supabase db push` once the
-- project is linked (see README.md for setup steps).

-- ── profiles ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 24),
  full_name text not null check (char_length(full_name) between 1 and 80),
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  grade smallint check (grade between 6 and 12),
  school text,
  city text,
  state text,
  interests text[] not null default '{}',
  is_minor boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── follows ─────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

create policy "follows are readable by authenticated users"
  on public.follows for select
  to authenticated
  using (true);

create policy "users can follow as themselves"
  on public.follows for insert
  to authenticated
  with check (auth.uid() = follower_id);

create policy "users can unfollow as themselves"
  on public.follows for delete
  to authenticated
  using (auth.uid() = follower_id);

-- ── posts ───────────────────────────────────────────────────────────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  image_url text,
  created_at timestamptz not null default now()
);

create index if not exists posts_user_id_created_at_idx
  on public.posts (user_id, created_at desc);

alter table public.posts enable row level security;

create policy "posts are readable by authenticated users"
  on public.posts for select
  to authenticated
  using (true);

create policy "users can create their own posts"
  on public.posts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can delete their own posts"
  on public.posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── likes ───────────────────────────────────────────────────────────────
create table if not exists public.likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.likes enable row level security;

create policy "likes are readable by authenticated users"
  on public.likes for select
  to authenticated
  using (true);

create policy "users can like as themselves"
  on public.likes for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can unlike as themselves"
  on public.likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── comments ────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_id_created_at_idx
  on public.comments (post_id, created_at);

alter table public.comments enable row level security;

create policy "comments are readable by authenticated users"
  on public.comments for select
  to authenticated
  using (true);

create policy "users can comment as themselves"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can delete their own comments"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── content_items (seeded career/skill library) ───────────────────────────
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  type text not null check (type in ('article', 'video', 'quiz_link')),
  category text not null check (
    category in ('career_guidance', 'upskilling', 'job_readiness', 'tech_skills')
  ),
  url text,
  body text,
  thumbnail_url text,
  created_at timestamptz not null default now()
);

alter table public.content_items enable row level security;

create policy "content is readable by authenticated users"
  on public.content_items for select
  to authenticated
  using (true);

-- no insert/update/delete policies: v1 content is managed via the
-- Supabase dashboard / service role, not a public admin UI.

-- ── quiz_questions ──────────────────────────────────────────────────────
create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null,
  "order" smallint not null
);

alter table public.quiz_questions enable row level security;

create policy "quiz questions are readable by authenticated users"
  on public.quiz_questions for select
  to authenticated
  using (true);

-- ── quiz_results ────────────────────────────────────────────────────────
create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  answers jsonb not null,
  suggested_streams text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.quiz_results enable row level security;

create policy "users can read their own quiz results"
  on public.quiz_results for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can save their own quiz results"
  on public.quiz_results for insert
  to authenticated
  with check (auth.uid() = user_id);

-- ── reports ─────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'profile')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "users can file their own reports"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

-- No select/update policy for regular users on purpose: reports are
-- triaged via the Supabase dashboard (service role bypasses RLS) in v1.
