"use client";

import { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { reportCommunity } from "@/lib/actions/community";
import { Portal } from "@/components/portal";
import { cn } from "@/lib/utils";

const REASONS: { value: "spam" | "harassment" | "inappropriate" | "other"; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate for the platform" },
  { value: "other", label: "Other" },
];

/**
 * A small flag icon that opens a report dialog — same Portal + backdrop-
 * fade + Escape/backdrop-click-to-close pattern as components/message-
 * info-panel.tsx (mirrored, not reinvented — see that file's own comment
 * for why a Portal is required at all under swipe-navigator.tsx's
 * transformed page wrapper).
 *
 * Reports go into community_reports (0033_community_round4.sql), which
 * has no select policy at all — there's no moderation queue to show a
 * report's status in, by design (no moderator role exists in this app
 * yet — see lib/actions/community.ts's setCommunityThreadPinned for that
 * same call). This dialog is deliberately just "capture and thank them,"
 * not a report-history view.
 */
export function ReportButton({
  targetType,
  targetId,
  className,
}: {
  targetType: "thread" | "reply";
  targetId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("spam");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function close() {
    setMounted(false);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setError(null);
      setReason("spam");
      setDetails("");
    }, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    const result = await reportCommunity(targetType, targetId, reason, details);
    setIsPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Report"
        className={cn("text-muted-foreground hover:text-destructive", className)}
      >
        <Flag className="h-3.5 w-3.5" />
      </button>

      {open && (
        <Portal>
          <div
            onClick={close}
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
              {submitted ? (
                <>
                  <p className="text-sm font-medium text-foreground">Thanks — we&apos;ll look into it.</p>
                  <button
                    type="button"
                    onClick={close}
                    className="mt-3 text-sm font-medium text-primary hover:underline"
                  >
                    Close
                  </button>
                </>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    Report this {targetType === "thread" ? "thread" : "reply"}
                  </h2>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as typeof reason)}
                    className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {REASONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Anything else we should know? (optional)"
                    rows={3}
                    maxLength={500}
                    className="block w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {isPending ? "Submitting…" : "Submit report"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
