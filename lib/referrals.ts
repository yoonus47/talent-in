// Shared between lib/supabase/proxy.ts (sets it) and
// lib/actions/profile.ts (reads it) — one source of truth so the two sides
// of the referral-capture flow can't silently drift apart.
export const REFERRAL_COOKIE = "tz_ref";
