-- Profile self-expression fields: a one-line status, a skills list
-- (separate from profiles.interests — "what I'm good at" vs "what I'm
-- into"), and a few social/creator handles. All plain user-editable "about
-- me" fields, same trust level as bio/interests already have — no new
-- grant/RLS work needed, the existing self-update policy on profiles
-- (auth.uid() = id, 0001_init.sql) already covers them.

alter table public.profiles add column if not exists status text;
alter table public.profiles add column if not exists skills text[] not null default '{}';
alter table public.profiles add column if not exists instagram_handle text;
alter table public.profiles add column if not exists youtube_handle text;
alter table public.profiles add column if not exists github_handle text;
