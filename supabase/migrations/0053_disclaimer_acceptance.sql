-- TalentZify — tracks whether a user has accepted the pre-launch
-- experimental-software disclaimer (components/disclaimer-modal.tsx).
-- Null means "never accepted." During the testing phase the modal
-- ignores this and shows on every login regardless (a flag in the
-- component itself controls that, not this column) — this column exists
-- so flipping that flag off at launch has something real to check
-- against, without a second migration then.

alter table public.profiles
  add column if not exists disclaimer_accepted_at timestamptz;

-- Same self-write posture as last_active_at (0034) — a user accepting
-- for themselves, nothing else reads or depends on this column's value
-- besides the modal's own "should I show" check.
grant update (disclaimer_accepted_at) on public.profiles to authenticated;
