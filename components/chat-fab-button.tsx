"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchUnreadMessageCount } from "@/lib/actions/chat";

/**
 * The actual floating button — split from ChatFab (which fetches the
 * initial unread count server-side) so it can read the current route
 * client-side (hiding itself inside /chat) and own its count live from
 * mount onward.
 *
 * `unreadCount` (the server prop) is only the very first paint's value,
 * never re-synced later — same reasoning as NotificationBell: ChatFab
 * lives in the root layout, and Next can serve that layout from a
 * prefetched cache captured before a message arrived or got read, so
 * trusting later prop updates would periodically clobber correct live
 * state with a stale one. Two things can change the true count: a new
 * message arriving in any conversation (INSERT on messages — no filter,
 * since RLS already scopes delivery to conversations this user is a
 * participant in), or this user's own read-marker advancing anywhere
 * (UPDATE on their own conversation_reads row — covers both opening a
 * thread on another tab/device and ChatThread's own auto-mark-read while
 * a message arrives with the thread open). Either one triggers a fresh
 * refetch rather than incremental math, avoiding drift.
 */
export function ChatFabButton({ userId, unreadCount: initialUnreadCount }: { userId: string; unreadCount: number }) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function refresh() {
      const count = await fetchUnreadMessageCount();
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
        .channel(`unread-messages:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
        // markConversationRead upserts: the *first* time a given
        // conversation is ever read, that's a plain INSERT into
        // conversation_reads (no existing row for this pair yet), not an
        // UPDATE — missing that case is exactly why the badge didn't
        // clear immediately after reading a brand-new conversation.
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "conversation_reads", filter: `user_id=eq.${userId}` },
          refresh,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "conversation_reads", filter: `user_id=eq.${userId}` },
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

  if (pathname.startsWith("/chat")) return null;

  return (
    <Link
      href="/chat"
      aria-label="Messages"
      title="Messages"
      // Stacked above ThemeToggle (fixed bottom-4 right-4, h-11) so the two
      // floating buttons don't overlap. --gradient-messaging (app/globals.css)
      // is this app's own indigo→cyan gradient — deliberately its own
      // color, distinct from --gradient-brand (the wordmark's burgundy-
      // to-indigo gradient) — giving this its own identity instead of
      // blending in with every other plain bg-primary button in the app.
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
      style={{ background: "var(--gradient-messaging)" }}
    >
      <MessageCircle className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
