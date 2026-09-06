import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Supabase client for use in Client Components ("use client").
 * Reads the public URL/anon key — safe to expose in the browser.
 *
 * Memoized to one instance per page load (unlike the server client, which
 * must be created fresh per request for its request-scoped cookies — this
 * one has no such constraint). Each SupabaseClient opens its own Realtime
 * WebSocket connection; before this, every component that called
 * createClient() independently (NotificationBell, ChatFabButton,
 * ChatThread) opened its own socket, so a single user on a /chat/[id]
 * page held 3 concurrent Realtime connections instead of 1 — directly
 * eating into Supabase's per-project concurrent-connection quota for no
 * benefit, since all three run under the same signed-in session anyway.
 */
let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  browserClient ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return browserClient;
}
