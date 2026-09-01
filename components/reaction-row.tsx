import { REACTIONS, type ReactionType } from "@/lib/reactions";
import { cn } from "@/lib/utils";

/**
 * The row of reaction buttons — shared between posts and comments so both
 * get the exact same polished styling/behavior instead of duplicated JSX.
 * Stays a plain (non-"use client") component: each button is its own
 * <form> bound to a server action, same progressive-enhancement pattern
 * used everywhere else in this app, so no client boundary is needed here.
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
    <div className={cn("flex flex-wrap items-center", size === "sm" ? "gap-0.5" : "gap-1")}>
      {REACTIONS.map((reaction) => {
        const isMine = myReaction === reaction.type;
        const count = counts[reaction.type];
        return (
          <form key={reaction.type} action={buildAction(reaction.type)}>
            <button
              type="submit"
              title={reaction.label}
              className={cn(
                "flex items-center gap-1 rounded-full transition-colors hover:bg-muted",
                size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm",
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
