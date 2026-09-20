import { REACTIONS, type ReactionType } from "@/lib/reactions";
import { cn } from "@/lib/utils";

/**
 * The row of reaction buttons — shared between posts and comments so both
 * get the exact same polished styling/behavior instead of duplicated JSX.
 * Stays a plain (non-"use client") component: each button is its own
 * <form> bound to a server action, same progressive-enhancement pattern
 * used everywhere else in this app, so no client boundary is needed here.
 *
 * Buttons get a fixed height (not just padding) so the tap target stays a
 * comfortable, consistent size on a touch-first surface regardless of
 * whether a count happens to be showing, and the whole row sits inside a
 * soft grouping pill so it reads as one distinct control next to
 * ReactionSummary's similarly-sized (but purely read-only) chips.
 */
export function ReactionRow({
  counts,
  myReaction,
  buildAction,
  size = "md",
}: {
  counts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
  buildAction: (type: ReactionType) => (formData: FormData) => void | Promise<void>;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center rounded-full bg-muted/40",
        size === "sm" ? "gap-1 p-0.5" : "gap-1.5 p-1",
      )}
    >
      {REACTIONS.map((reaction) => {
        const isMine = myReaction === reaction.type;
        const count = counts[reaction.type];
        return (
          <form key={reaction.type} action={buildAction(reaction.type)}>
            <button
              type="submit"
              title={reaction.label}
              className={cn(
                "flex items-center justify-center gap-1 rounded-full transition-colors hover:bg-muted",
                size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-sm",
                isMine && "bg-primary/10 text-primary",
              )}
            >
              <span>{reaction.emoji}</span>
              {count > 0 && (
                <span className={size === "sm" ? "text-[10px]" : "text-xs"}>{count}</span>
              )}
            </button>
          </form>
        );
      })}
    </div>
  );
}
