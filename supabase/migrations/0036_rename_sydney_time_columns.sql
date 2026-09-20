-- Rename-only — 0035 already converts these using `Australia/Sydney`,
-- which auto-switches between AEST (UTC+10) and AEDT (UTC+11) with
-- daylight saving, so the values were already correct. The "_aest"
-- suffix was just a misleading label: right now (pre-DST, which starts
-- the first Sunday of October) Sydney time happens to equal AEST, so the
-- name looked right without actually being tied to it — it'll silently
-- become wrong-looking once daylight saving starts and these are AEDT.
-- ALTER VIEW RENAME COLUMN doesn't drop/recreate the view, so the 0035
-- lockdown (revoke all from public/anon/authenticated) stays intact —
-- nothing to re-apply here.
alter view public.user_safety_summary rename column last_active_at_aest to last_active_at_sydney;
alter view public.user_safety_summary rename column joined_at_aest to joined_at_sydney;
