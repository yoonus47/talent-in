"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchUnreadMessageCount, markConversationDelivered } from "@/lib/actions/chat";
import { TransitionLink } from "@/components/transition-link";
import type { Message } from "@/lib/types/database";

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
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            refresh();
            // The real "my device is online and received this" signal —
            // this subscription is already global (no conversation_id
            // filter) and lives in the root layout, so it fires no matter
            // which page the app is on. See lib/actions/chat.ts's
            // markConversationDelivered and supabase/migrations/
            // 0029_delivery_receipts.sql for the other two (catch-up)
            // call sites this alone doesn't cover — offline at send time.
            const newRow = payload.new as Message;
            if (newRow.sender_id !== userId) {
              markConversationDelivered(newRow.conversation_id);
            }
          },
        )
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
    <TransitionLink
      href="/chat"
      direction="forward"
      aria-label="Messages"
      title="Messages"
      // bottom-20 clears components/mobile-tab-bar.tsx's fixed bar on
      // mobile with room to spare; sm:bottom-4 tucks it back into the
      // corner on desktop, which has no bottom tab bar to clear.
      // --messaging (app/globals.css) is a solid cyan, deliberately
      // distinct from --primary — its own identity instead of blending in
      // with every other plain bg-primary button in the app. Was a
      // two-tone gradient; dropped once --primary became sky blue and the
      // gradient's two stops sat too close in hue to read as one at this
      // 48px size.
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 sm:bottom-4"
      style={{ background: "var(--messaging)" }}
    >
      <MessageCircle className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </TransitionLink>
  );
}
