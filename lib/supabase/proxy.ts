import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_CODE_PATTERN } from "@/lib/validation";
import { REFERRAL_COOKIE } from "@/lib/referrals";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth", "/student", "/coming-soon", "/r"];

const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Refreshes the Supabase session on every request and gates access to
 * authenticated-only routes. Called from the root `proxy.ts` (Next.js 16
 * renamed "Middleware" to "Proxy" — see node_modules/next/dist/docs).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: this call must not be removed — it refreshes the auth token
  // and must run before any other Supabase call in the request lifecycle.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Referral capture: app/r/[username]/page.tsx redirects here with
  // ?ref=<username>. Caught here (on the page visit itself, via a cookie)
  // rather than as a hidden form field, since it has to survive both the
  // email-confirmation gap and the "Continue with Google" button — neither
  // of which is a form submission on this page. Redeemed once, in
  // lib/actions/profile.ts's completeOnboarding (see 0040_referral_points.sql).
  if (pathname === "/signup") {
    const ref = request.nextUrl.searchParams.get("ref")?.toLowerCase();
    if (ref && REFERRAL_CODE_PATTERN.test(ref)) {
      supabaseResponse.cookies.set(REFERRAL_COOKIE, ref, {
        maxAge: REFERRAL_COOKIE_MAX_AGE,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }

  return supabaseResponse;
}
