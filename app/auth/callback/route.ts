import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parsePlatformOs, parsePlatformBrowser } from "@/lib/user-agent";

// Handles the redirect back from Supabase after email confirmation,
// Google OAuth, or a password-reset link, exchanges the `code` for a
// session, then sends the user on to `next` (defaults to onboarding:
// profile creation checks whether one already exists; app/reset-password/
// page.tsx uses `?next=/reset-password` instead). `next` must be a
// same-site relative path (a leading `/` but not `//`, protocol-relative)
// before use: it's only ever set by our own redirectTo/emailRedirectTo
// calls today, but it arrives as a plain query param on a GET request,
// so it's validated as if it weren't trusted.
function safeNextPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/onboarding";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  // `origin` above is derived from `request.url`, which on serverless
  // platforms (e.g. AWS Amplify) often reflects the internal address the
  // Next.js server is bound to (localhost:<port>) rather than the public
  // domain, even though the Host header is correct. Prefer the
  // forwarded-host headers a proxy/CDN sets, same fix Supabase's own
  // Next.js SSR examples use for exactly this scenario.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const safeOrigin = forwardedHost
    ? `${forwardedProto ?? "https"}://${forwardedHost}`
    : origin;

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Covers Google OAuth sign-in and email-confirmation completion.
      // See lib/user-agent.ts and 0025_platform_tracking.sql. A brand-new
      // user has no profiles row yet (created during onboarding, next),
      // so this just affects 0 rows for them, harmlessly.
      if (data.user) {
        const userAgent = request.headers.get("user-agent");
        await supabase
          .from("profiles")
          .update({
            platform_os: parsePlatformOs(userAgent),
            platform_browser: parsePlatformBrowser(userAgent),
            platform_updated_at: new Date().toISOString(),
          })
          .eq("id", data.user.id);
      }
      return NextResponse.redirect(`${safeOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${safeOrigin}/login?error=Could not sign you in`);
}
