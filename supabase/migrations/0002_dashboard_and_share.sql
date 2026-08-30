-- TalentZify — Dashboard, daily challenges, and post sharing.
-- Run this in the Supabase SQL editor after 0001_init.sql.

-- ── shares (reposts) ────────────────────────────────────────────────────
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

create index if not exists shares_post_id_idx on public.shares (post_id);
create index if not exists shares_user_id_created_at_idx
  on public.shares (user_id, created_at desc);

alter table public.shares enable row level security;

create policy "shares are readable by authenticated users"
  on public.shares for select
  to authenticated
  using (true);

create policy "users can share as themselves"
  on public.shares for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can unshare as themselves"
  on public.shares for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── challenge_questions ─────────────────────────────────────────────────
-- Deliberately no SELECT policy for regular users: the answer key
-- (`correct_index`) must never be fetchable directly from the browser.
-- Reads only happen through `get_daily_challenge()` below, which is
-- SECURITY DEFINER and therefore bypasses RLS as the function owner.
create table if not exists public.challenge_questions (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('math', 'science')),
  question text not null,
  options jsonb not null,
  correct_index smallint not null,
  created_at timestamptz not null default now()
);

alter table public.challenge_questions enable row level security;
-- (no policies — default deny for all non-owner roles)

-- ── challenge_attempts ──────────────────────────────────────────────────
create table if not exists public.challenge_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  challenge_date date not null,
  score smallint not null,
  total smallint not null,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_date)
);

alter table public.challenge_attempts enable row level security;

create policy "users can read their own challenge attempts"
  on public.challenge_attempts for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert policy: rows are only written by `submit_daily_challenge()`
-- below, which bypasses RLS as the function owner. A client can't POST a
-- fabricated score directly.

-- ── get_daily_challenge() ───────────────────────────────────────────────
-- Picks the same 5 questions for every student on a given calendar day —
-- deterministic per-day shuffle, no cron job needed. Returns only the
-- columns safe to show before answering (no `correct_index`).
create or replace function public.get_daily_challenge()
returns table (
  id uuid,
  subject text,
  question text,
  options jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select cq.id, cq.subject, cq.question, cq.options
  from public.challenge_questions cq
  order by md5(cq.id::text || current_date::text)
  limit 5;
$$;

grant execute on function public.get_daily_challenge() to authenticated;

-- ── submit_daily_challenge(jsonb) ───────────────────────────────────────
-- p_answers: [{"question_id": "<uuid>", "selected_index": 2}, ...]
-- Recomputes today's actual question set server-side (so a client can't
-- submit made-up question ids), grades it, upserts the attempt, and
-- returns a per-question recap without ever exposing the answer key
-- ahead of submission.
create or replace function public.submit_daily_challenge(p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := current_date;
  v_score smallint := 0;
  v_total smallint := 0;
  v_results jsonb := '[]'::jsonb;
  v_question record;
  v_selected smallint;
  v_correct boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  for v_question in
    select cq.id, cq.correct_index
    from public.challenge_questions cq
    order by md5(cq.id::text || v_today::text)
    limit 5
  loop
    v_total := v_total + 1;

    select (elem->>'selected_index')::smallint
      into v_selected
      from jsonb_array_elements(p_answers) elem
      where (elem->>'question_id')::uuid = v_question.id
      limit 1;

    v_correct := v_selected is not null and v_selected = v_question.correct_index;
    if v_correct then
      v_score := v_score + 1;
    end if;

    v_results := v_results || jsonb_build_object(
      'question_id', v_question.id,
      'correct', coalesce(v_correct, false)
    );
  end loop;

  insert into public.challenge_attempts (user_id, challenge_date, score, total)
  values (v_user_id, v_today, v_score, v_total)
  on conflict (user_id, challenge_date)
  do update set score = excluded.score, total = excluded.total;

  return jsonb_build_object('score', v_score, 'total', v_total, 'results', v_results);
end;
$$;

grant execute on function public.submit_daily_challenge(jsonb) to authenticated;
