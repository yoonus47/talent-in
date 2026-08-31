import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the redirect back from Supabase after email confirmation or
// Google OAuth, exchanges the `code` for a session, then sends the user
// on to onboarding (profile creation checks whether one already exists).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // `origin` above is derived from `request.url`, which on serverless
  // platforms (e.g. AWS Amplify) often reflects the internal address the
  // Next.js server is bound to (localhost:<port>) rather than the public
  // domain — even though the Host header is correct. Prefer the
  // forwarded-host headers a proxy/CDN sets, same fix Supabase's own
  // Next.js SSR examples use for exactly this scenario.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const safeOrigin = forwardedHost
    ? `${forwardedProto ?? "https"}://${forwardedHost}`
    : origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${safeOrigin}/onboarding`);
    }
  }

  return NextResponse.redirect(`${safeOrigin}/login?error=Could not sign you in`);
}
