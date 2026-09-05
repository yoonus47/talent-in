-- TalentZify — Word of the Day + vocabulary daily-challenge questions.
-- Run this in the Supabase SQL editor after 0013_grant_image_dimensions_update.sql.

-- ── vocabulary_words ────────────────────────────────────────────────────
-- Unlike challenge_questions, there's no secret to protect here — a
-- definition isn't an answer key, it's meant to be read. A plain
-- authenticated-read policy is enough, same shape as content_items.
create table if not exists public.vocabulary_words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  part_of_speech text not null,
  definition text not null,
  example_sentence text not null,
  created_at timestamptz not null default now()
);

alter table public.vocabulary_words enable row level security;

create policy "vocabulary words are readable by authenticated users"
  on public.vocabulary_words for select
  to authenticated
  using (true);

-- ── widen challenge_questions to accept a vocabulary subject ────────────
-- get_daily_challenge() / submit_daily_challenge() already pick from every
-- row in this table regardless of subject — no function changes needed,
-- vocabulary questions are automatically eligible for the daily 5-question
-- mix the moment rows with this subject exist.
alter table public.challenge_questions drop constraint if exists challenge_questions_subject_check;
alter table public.challenge_questions
  add constraint challenge_questions_subject_check
  check (subject in ('math', 'science', 'vocabulary'));
