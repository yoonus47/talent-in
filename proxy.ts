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
     * - api/ (API routes handle their own auth — this app's first one,
     *   /api/cron/expire-voice-messages, is called by an external
     *   scheduler with no user session at all, just a shared-secret
     *   header; the login-redirect above would otherwise 307 it before
     *   the route handler ever runs, confirmed live)
     */
    "/((?!api/|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
