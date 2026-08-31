"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Marks the current user's unread notifications as read. Called directly
 * during /notifications' render (not via a form submit), so this must NOT
 * call revalidatePath/redirect — those are only valid inside a real Server
 * Action invocation or Route Handler, and calling them mid-render throws
 * (that's what broke this page). The route is fully dynamic anyway
 * (cookies-based auth), so there's no cache to invalidate here.
 */
export async function markAllNotificationsRead(userId: string) {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
}
