"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { blockUser } from "@/lib/actions/block";
import { Portal } from "@/components/portal";
import { cn } from "@/lib/utils";

/**
 * Confirm-before-block — same Portal + backdrop-fade + Escape/backdrop-
 * click-to-close mechanics as components/report-button.tsx, minus the
 * reason picker (nobody's notified of a block, there's nothing to log a
 * reason for). Blocking is symmetric (see supabase/migrations/
 * 0048_user_blocking.sql): the target's profile becomes unreachable to
 * *both* sides immediately, so this redirects away rather than leaving
 * the confirmer stuck on a profile page that would now 404 on refresh.
 */
export function BlockUserDialog({
  targetUserId,
  targetUsername,
  onClose,
}: {
  targetUserId: string;
  targetUsername: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function handleConfirm() {
    setPending(true);
    await blockUser(targetUserId);
    router.push("/feed");
  }

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
            "w-full max-w-sm overflow-hidden rounded-xl bg-card p-4 shadow-lg transition-all duration-200",
            mounted ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          <h2 className="text-sm font-semibold text-foreground">Block @{targetUsername}?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            They won&apos;t be able to follow you, message you, or view your profile, and you
            won&apos;t see theirs either. You can unblock them later from Account Settings.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Blocking…" : "Block"}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
