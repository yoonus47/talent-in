"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCirclePlus } from "lucide-react";
import { startConversation } from "@/lib/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/types/database";

/**
 * "New message" entry point on /chat — lists mutual-follow profiles
 * (already fetched server-side, no autocomplete action needed: this list
 * is small, unlike the platform-wide mention search) with a client-side
 * filter. Picking one starts (or resumes) a conversation via
 * startConversation, same bound-server-action-in-a-form idiom as
 * ProfileRow's Follow button.
 *
 * Click-outside is a `pointerdown` listener on `document`, NOT a
 * `fixed inset-0` backdrop element. A backdrop here was a real bug: this
 * page renders inside components/swipe-navigator.tsx's transformed +
 * z-indexed page wrapper (a stacking context), so a backdrop portaled
 * out to <body> painted *above* this dropdown and swallowed every click
 * on a name — the picker just closed and no chat started. A listener has
 * no element and no z-index, so nothing to fight.
 */
export function NewChatPicker({ candidates }: { candidates: Profile[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = candidates.filter((p) =>
    `${p.full_name} ${p.username}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative" ref={rootRef}>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        <MessageCirclePlus className="h-4 w-4" />
        New
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-lg border border-border bg-card p-2 shadow-md">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people you follow…"
            autoFocus
            className="mb-2 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                {candidates.length === 0
                  ? "Follow each other with someone to start a chat."
                  : "No matches."}
              </p>
            ) : (
              filtered.map((p) => (
                <form key={p.id} action={startConversation.bind(null, p.id)}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                  >
                    <Avatar name={p.full_name} src={p.avatar_url} size={32} />
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{p.full_name}</span>{" "}
                      <span className="text-muted-foreground">@{p.username}</span>
                    </span>
                  </button>
                </form>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
