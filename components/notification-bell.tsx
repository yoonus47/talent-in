"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchUnreadNotificationCount } from "@/lib/actions/notifications";

/**
 * The navbar bell. `initialUnreadCount` is only ever used for the very
 * first paint — it is NOT re-synced from later prop updates. It can't be:
 * Navbar is part of the root layout, which Next may serve from a
 * prefetched cache captured before a notification arrived (or got marked
 * read); trusting that prop on every re-render would periodically
 * overwrite correct live state with a stale one. Instead this owns its
 * count from mount onward — refetching the true value once immediately
 * (to correct any staleness in that very first prop) and again on every
 * realtime INSERT/UPDATE on `notifications` for this user (a new
 * notification, or one/all getting marked read elsewhere, e.g. by
 * visiting /notifications).
 *
 * Same realtime setup as components/chat-thread.tsx, including the
 * explicit supabase.realtime.setAuth() call — without it the
 * @supabase/ssr browser client's socket never attaches the session's
 * token and RLS silently drops every event.
 */
export function NotificationBell({
  userId,
  initialUnreadCount,
}: {
  userId: string;
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function refresh() {
      const count = await fetchUnreadNotificationCount();
      if (!cancelled) setUnreadCount(count);
    }

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      await refresh();

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          refresh,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          refresh,
        )
        .subscribe();
    }

    subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link href="/notifications" title="Notifications" className="relative">
      <Bell className="h-5 w-5 text-muted-foreground hover:text-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
