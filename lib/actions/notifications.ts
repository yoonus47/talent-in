"use server";

import { createClient } from "@/lib/supabase/server";
import { getUnreadNotificationCount } from "@/lib/data";

/**
 * Fresh unread count, callable from the client. NotificationBell
 * (components/notification-bell.tsx) calls this on mount and whenever its
 * realtime subscription sees a relevant change — the server-rendered
 * `initialUnreadCount` prop it starts from can be stale (Next prefetches
 * linked routes, including the root layout, ahead of a click; if that
 * prefetch was captured before a notification arrived or got marked read,
 * clicking the link serves the stale cached count instead of a fresh
 * fetch). This is the self-correcting escape hatch from that staleness.
 */
export async function fetchUnreadNotificationCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  return getUnreadNotificationCount(user.id);
}

/**
 * Marks the current user's unread notifications as read. Called directly
 * during /notifications' render (not via a form submit), so this must NOT
 * call revalidatePath/redirect — those are only valid inside a real Server
 * Action invocation or Route Handler, and calling them mid-render throws
 * (that's what broke this page). The route is fully dynamic anyway
 * (cookies-based auth), so there's no cache to invalidate here.
 *
 * Takes no id — derives the current user from the session itself rather
 * than trusting a caller-supplied one, unlike every other exported
 * "use server" function here that's only ever called with the caller's
 * own id in practice (this one's the exception, not the rule).
 */
export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
}
