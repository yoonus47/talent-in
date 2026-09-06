"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * The navbar bell — same visual as before, but now live: a realtime
 * subscription bumps the count the instant a notification row is
 * inserted, instead of only on the next page load. Mirrors
 * components/chat-thread.tsx's realtime setup, including the explicit
 * supabase.realtime.setAuth() call — without it the @supabase/ssr browser
 * client's socket never actually attaches the session's token, and RLS
 * silently drops every event (confirmed live while building chat).
 *
 * `initialUnreadCount` comes from Navbar's own server-side fetch on every
 * navigation; Navbar (and this component) persist across client-side
 * navigations as part of the root layout, so this effect re-syncs local
 * state down to the fresh server count each time — that's what makes the
 * badge actually clear after visiting /notifications (which marks
 * everything read), rather than staying stuck at a realtime-incremented
 * value forever.
 */
export function NotificationBell({
  userId,
  initialUnreadCount,
}: {
  userId: string;
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  // React's documented "adjust state when a prop changes" pattern —
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  // — a setState call in an effect body here would cascade an extra
  // render on every navigation; this bails out after one instead.
  const [prevInitialUnreadCount, setPrevInitialUnreadCount] = useState(initialUnreadCount);
  if (initialUnreadCount !== prevInitialUnreadCount) {
    setPrevInitialUnreadCount(initialUnreadCount);
    setUnreadCount(initialUnreadCount);
  }

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => setUnreadCount((count) => count + 1),
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
