"use client";

import { useState } from "react";
import { MessageCirclePlus } from "lucide-react";
import { startConversation } from "@/lib/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Portal } from "@/components/portal";
import type { Profile } from "@/lib/types/database";

/**
 * "New message" entry point on /chat — lists mutual-follow profiles
 * (already fetched server-side, no autocomplete action needed: this list
 * is small, unlike the platform-wide mention search) with a client-side
 * filter. Picking one starts (or resumes) a conversation via
 * startConversation, same bound-server-action-in-a-form idiom as
 * ProfileRow's Follow button.
 */
export function NewChatPicker({ candidates }: { candidates: Profile[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = candidates.filter((p) =>
    `${p.full_name} ${p.username}`.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="relative">
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
        <MessageCirclePlus className="h-4 w-4" />
        New
      </Button>

      {open && (
        <>
          {/* Portaled: same reason as components/post-lightbox.tsx — this
              page's content sits inside swipe-navigator's transformed
              wrapper, which breaks a plain `fixed inset-0` click-outside
              catcher the same way it broke the lightbox. */}
          <Portal>
            <button
              type="button"
              aria-label="Close"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setOpen(false)}
            />
          </Portal>
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
        </>
      )}
    </div>
  );
}
