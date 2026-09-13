import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed "Middleware" to "Proxy" (file + export name) — see
// node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - static assets (svg, png, jpg, jpeg, gif, webp, ico)
     * - api/ (API routes handle their own auth, not cookie-based sessions
     *   — confirmed live with an earlier cron route: the login-redirect
     *   above 307'd it before the handler ever ran, since a route hit by
     *   an external caller has no session at all)
     */
    "/((?!api/|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
