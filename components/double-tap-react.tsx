"use client";

import { useRef, useState, type ReactNode } from "react";
import { REACTIONS, type ReactionType } from "@/lib/reactions";
import { cn } from "@/lib/utils";

/** Instagram's own convention: double-tap always *sets* this reaction, it
 * never un-reacts — an extra double-tap on something already reacted to
 * just re-plays the burst, harmlessly. Shared by posts and comments so
 * both use the exact same default and behavior. Exported so callers bind
 * their action to this exact type, not a hardcoded duplicate of it. */
export const DOUBLE_TAP_REACTION: ReactionType = "heart";
const DOUBLE_TAP_WINDOW_MS = 300;

/**
 * Wraps post/comment content to make it double-tap (or double-click)
 * reactive. `reactAction` must be a *fully*-bound server action (e.g.
 * `setReaction.bind(null, postId, authorId, DOUBLE_TAP_REACTION,
 * myReaction)`) — a factory function that *returns* a bound action when
 * called (like ReactionRow's `buildAction`) will not work here: that
 * factory is a plain closure, and only an actual bound server action
 * reference is allowed to cross from a Server Component into a Client
 * Component's props. Submitted via a real (hidden) form rather than
 * called directly, for the same reason — calling a passed-down action
 * reference imperatively silently never reaches the server, only
 * rendering it into a real <form action> does.
 */
export function DoubleTapReact({
  myReaction,
  reactAction,
  children,
  className,
}: {
  myReaction: ReactionType | null;
  reactAction: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  className?: string;
}) {
  const [burst, setBurst] = useState(false);
  const lastTapRef = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);

  // A manual timing-based double-tap detector, not the native `dblclick`
  // event — touch-to-dblclick synthesis is inconsistent across mobile
  // browsers, whereas comparing two onClick timestamps works identically
  // for a mouse double-click and a finger double-tap.
  function handleTap() {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_WINDOW_MS;
    lastTapRef.current = isDoubleTap ? 0 : now;
    if (!isDoubleTap) return;

    if (myReaction !== DOUBLE_TAP_REACTION) {
      formRef.current?.requestSubmit();
    }
    setBurst(true);
    setTimeout(() => setBurst(false), 600);
  }

  const emoji = REACTIONS.find((r) => r.type === DOUBLE_TAP_REACTION)?.emoji ?? "❤️";

  return (
    <div onClick={handleTap} className={cn("relative touch-manipulation select-none", className)}>
      {children}
      <form ref={formRef} action={reactAction} className="hidden" />
      {burst && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl animate-[ping_0.6s_ease-out]">
          {emoji}
        </span>
      )}
    </div>
  );
}
