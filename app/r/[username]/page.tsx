import { redirect } from "next/navigation";

/**
 * The short, shareable form of a referral link (talentzify.com/r/<username>)
 * — just a redirect to /signup?ref=<username>, where lib/supabase/proxy.ts
 * actually captures it into a cookie. No DB lookup here on purpose: an
 * unknown/mistyped username still redirects fine, and redeem_referral
 * (supabase/migrations/0040_referral_points.sql) is what safely no-ops on
 * a bad code, so there's nothing to validate on this hot path.
 */
export default async function ReferralRedirectPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  redirect(`/signup?ref=${encodeURIComponent(username)}`);
}
