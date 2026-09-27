import { REACTIONS, type ReactionType } from "@/lib/reactions";
import { cn } from "@/lib/utils";

/**
 * The "combined counter" — stacked reaction emojis (only types anyone
 * actually used) plus the total count, as one small chip. Replaces
 * separately showing an emoji breakdown and a count as two things.
 *
 * `onOpenReactors`, when passed, turns this from a static chip into the
 * trigger for components/reactors-modal.tsx's "who reacted" list — the
 * same LinkedIn convention where tapping the reaction count itself (not
 * just double-tapping to react) shows who's behind it.
 */
export function ReactionSummary({
  counts,
  size = "md",
  onOpenReactors,
}: {
  counts: Record<ReactionType, number>;
  size?: "sm" | "md";
  onOpenReactors?: () => void;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const active = REACTIONS.filter((r) => counts[r.type] > 0);
  const chipSize = size === "sm" ? "h-3.5 w-3.5 text-[9px]" : "h-4 w-4 text-[10px]";

  const content = (
    <>
      <span className="flex -space-x-1">
        {active.map((r) => (
          <span
            key={r.type}
            title={r.label}
            className={cn(
              "flex items-center justify-center rounded-full bg-card ring-1 ring-card",
              chipSize,
            )}
          >
            {r.emoji}
          </span>
        ))}
      </span>
      <span>{total}</span>
    </>
  );

  const className = cn(
    "flex items-center gap-1 text-muted-foreground",
    size === "sm" ? "text-[11px]" : "text-xs",
  );

  if (!onOpenReactors) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpenReactors}
      aria-label="See who reacted"
      className={cn(className, "hover:text-foreground hover:underline")}
    >
      {content}
    </button>
  );
}
