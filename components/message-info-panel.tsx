"use client";

import { useEffect, useState } from "react";
import { CheckCheck, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Portal } from "@/components/portal";
import { cn, timeAgo } from "@/lib/utils";

type InfoRow = { id: string; full_name: string; avatar_url: string | null; at?: string };

/**
 * "Message info" — group chats only (components/chat-thread.tsx's
 * onShowInfo). Same Portal + backdrop-fade + Escape/backdrop-click-to-
 * close pattern as components/post-lightbox.tsx, mirrored rather than
 * reinvented: this needs the same escape from swipe-navigator.tsx's
 * transformed page wrapper a `fixed` overlay always does (see Portal's
 * own comment for why that's not optional).
 */
export function MessageInfoPanel({
  readBy,
  deliveredTo,
  onClose,
}: {
  readBy: InfoRow[];
  deliveredTo: InfoRow[];
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

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

  const isEmpty = readBy.length === 0 && deliveredTo.length === 0;

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
            "w-full max-w-sm overflow-hidden rounded-xl bg-card shadow-lg transition-all duration-200",
            mounted ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Message info</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-4">
            {isEmpty ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Not delivered to anyone yet.
              </p>
            ) : (
              <>
                {readBy.length > 0 && (
                  <InfoSection title="Read by" rows={readBy} tone="read" />
                )}
                {deliveredTo.length > 0 && (
                  <InfoSection
                    title="Delivered to"
                    rows={deliveredTo}
                    tone="delivered"
                    className={readBy.length > 0 ? "mt-4" : ""}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function InfoSection({
  title,
  rows,
  tone,
  className,
}: {
  title: string;
  rows: InfoRow[];
  tone: "read" | "delivered";
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <CheckCheck
          className="h-3.5 w-3.5"
          style={tone === "read" ? { color: "var(--read-receipt)" } : undefined}
        />
        {title}
      </div>
      <div className="mt-2 space-y-2.5">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2.5">
            <Avatar name={row.full_name} src={row.avatar_url} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{row.full_name}</p>
              {row.at && <p className="text-xs text-muted-foreground">{timeAgo(row.at)}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
