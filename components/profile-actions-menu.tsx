"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, UserX } from "lucide-react";
import { BlockUserDialog } from "@/components/block-user-dialog";
import { cn } from "@/lib/utils";

/**
 * The "···" trigger next to Follow/Message on someone else's profile.
 * Same plain `absolute` dropdown as components/user-menu.tsx (not a
 * Portal-based one like components/message-action-menu.tsx) — this sits
 * in normal page flow with no scroll-clipping or transformed ancestor
 * between it and its own `relative` wrapper, so the simpler pattern
 * applies here too.
 */
export function ProfileActionsMenu({
  targetUserId,
  targetUsername,
}: {
  targetUserId: string;
  targetUsername: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg",
          )}
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirmingBlock(true);
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-destructive hover:bg-muted"
          >
            <UserX className="h-4 w-4" />
            Block
          </button>
        </div>
      )}

      {confirmingBlock && (
        <BlockUserDialog
          targetUserId={targetUserId}
          targetUsername={targetUsername}
          onClose={() => setConfirmingBlock(false)}
        />
      )}
    </div>
  );
}
