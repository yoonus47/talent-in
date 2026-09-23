-- Referral points: every user gets a personal invite link (talentzify.com/r/
-- <username> — no separate code, the username already is one); when someone
-- signs up through it, both sides get 50 points. Mirrors profiles.
-- community_points' own pattern (0031_community_round3.sql): a server-only
-- column, written only by a security definer function with EXECUTE revoked
-- from every client role.

alter table public.profiles add column if not exists referral_points integer not null default 0;
-- See this migration's own verification note in the plan this came from:
-- column-level revoke doesn't reliably override a broader table-level grant
-- (found investigating last_active_at, 0034) — live-verify with a real
-- anon-key PATCH attempt before trusting this, same as community_points
-- (0031) should have been but wasn't at the time.
revoke update (referral_points) on public.profiles from authenticated;

-- One row per referred user, ever — the unique constraint on referred_id is
-- what makes redeem_referral() below idempotent (on conflict do nothing),
-- not just an audit log.
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

create policy "read own referrals" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_id);

-- No insert/update/delete policy for authenticated -> RLS default-denies
-- both (same "no policy = no access" posture as community_reports, 0033).
-- Explicit revoke too, for clarity matching this schema's style elsewhere.
revoke insert, update, delete on public.referrals from authenticated;

-- Client-callable (unlike award_community_points, which never is) — it has
-- to run as the newly-onboarded user's own session from completeOnboarding.
-- Never trusts a passed-in "who's being credited" id for the referred side,
-- only auth.uid(), so a malicious client can't credit an arbitrary account.
create or replace function public.redeem_referral(p_referrer_username text)
returns uuid -- the referrer's id if a new referral was recorded, else null
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referred_id uuid := auth.uid();
  v_inserted_id uuid;
begin
  if v_referred_id is null then
    return null;
  end if;

  select id into v_referrer_id from public.profiles
    where username = lower(trim(p_referrer_username));

  if v_referrer_id is null or v_referrer_id = v_referred_id then
    -- unknown code, or self-referral (structurally near-impossible since
    -- referred_id is always a brand-new profile, guarded anyway)
    return null;
  end if;

  insert into public.referrals (referrer_id, referred_id)
  values (v_referrer_id, v_referred_id)
  on conflict (referred_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return null; -- already redeemed for this user — idempotent no-op
  end if;

  update public.profiles set referral_points = referral_points + 50 where id = v_referrer_id;
  update public.profiles set referral_points = referral_points + 50 where id = v_referred_id;

  return v_referrer_id;
end;
$$;

revoke all on function public.redeem_referral(text) from public, anon;
grant execute on function public.redeem_referral(text) to authenticated;

-- ── notifications: referral_joined ──────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'follow', 'reaction', 'comment', 'share', 'reply', 'mention', 'comment_reaction',
    'group_added', 'community_reply', 'community_reaction', 'community_mention',
    'community_best_answer', 'referral_joined'
  ));
