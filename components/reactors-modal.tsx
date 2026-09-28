"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { Portal } from "@/components/portal";
import { Avatar } from "@/components/ui/avatar";
import { REACTIONS, type ReactionType, type Reactor } from "@/lib/reactions";
import { cn } from "@/lib/utils";

/**
 * LinkedIn-style "who reacted" list: a tab per reaction type across the
 * top (plus "All"), a scrollable list of people below. Deliberately
 * generic: it takes a `fetchReactors` loader instead of a postId/commentId
 * + a "kind" flag, so it never has to branch on post-vs-comment itself
 * (the achievements feature backed out of exactly that kind of needless
 * type-branching once already, see the settings-IA memory).
 *
 * Overlay mechanics (Portal, fade-in via `mounted`, Escape/backdrop to
 * close) copied from components/image-lightbox.tsx.
 */
export function ReactorsModal({
  fetchReactors,
  onClose,
}: {
  fetchReactors: () => Promise<Reactor[]>;
  onClose: () => void;
}) {
  const [reactors, setReactors] = useState<Reactor[] | null>(null);
  const [tab, setTab] = useState<ReactionType | "all">("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchReactors().then((result) => {
      if (!cancelled) setReactors(result);
    });
    return () => {
      cancelled = true;
    };
    // fetchReactors is a fresh closure each render by design (it just
    // binds an id). Only run this once per mount, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const counts: Partial<Record<ReactionType, number>> = {};
  for (const r of reactors ?? []) counts[r.reactionType] = (counts[r.reactionType] ?? 0) + 1;
  const activeTypes = REACTIONS.filter((r) => counts[r.type]);
  const shown = (reactors ?? []).filter((r) => tab === "all" || r.reactionType === tab);

  return (
    <Portal>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200",
          mounted ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "flex max-h-[70vh] w-full max-w-sm flex-col overflow-hidden rounded-lg bg-card shadow-lg transition-all duration-200",
            mounted ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Reactions</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {reactors && reactors.length > 0 && (
            <div className="flex shrink-0 flex-nowrap gap-1 overflow-x-auto border-b border-border px-3 py-2">
              <TabButton active={tab === "all"} onClick={() => setTab("all")}>
                All {reactors.length}
              </TabButton>
              {activeTypes.map((r) => (
                <TabButton key={r.type} active={tab === r.type} onClick={() => setTab(r.type)}>
                  {r.emoji} {counts[r.type]}
                </TabButton>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {reactors === null ? (
              <div className="space-y-1 p-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : shown.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">No reactions yet.</p>
            ) : (
              shown.map((reactor) => {
                const emoji = REACTIONS.find((r) => r.type === reactor.reactionType)?.emoji;
                return (
                  <Link
                    key={reactor.id}
                    href={`/profile/${reactor.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted"
                  >
                    <div className="relative shrink-0">
                      <Avatar name={reactor.full_name} src={reactor.avatar_url} size={40} />
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card text-[10px] ring-1 ring-card">
                        {emoji}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {reactor.full_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">@{reactor.username}</p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
