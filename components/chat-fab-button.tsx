"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";

/**
 * The actual floating button — split from ChatFab (which fetches the
 * unread count server-side) so it can read the current route client-side
 * and hide itself while already inside /chat.
 */
export function ChatFabButton({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  if (pathname.startsWith("/chat")) return null;

  return (
    <Link
      href="/chat"
      aria-label="Messages"
      title="Messages"
      // Stacked above ThemeToggle (fixed bottom-4 right-4, h-11) so the two
      // floating buttons don't overlap.
      className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary-hover"
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
