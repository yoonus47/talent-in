"use client";

import { X } from "lucide-react";
import { deleteMessage } from "@/lib/actions/chat";
import { cn, timeAgo } from "@/lib/utils";
import type { Message } from "@/lib/types/database";

/** One message bubble — right-aligned/accent when it's mine, with an
 * unsend control that shows on hover, mirroring DeleteCommentButton.
 * Bubbles from the same sender in a row are visually grouped: only the
 * *last* bubble in a run gets the tail corner, and a group thread shows
 * the sender's name once, above the first bubble in a run — see
 * ChatThread's run-detection for how `isLastInRun`/`senderName` are
 * computed. */
export function MessageBubble({
  message,
  isOwn,
  pending = false,
  isLastInRun = true,
  senderName,
}: {
  message: Message;
  isOwn: boolean;
  /** True while the message is still an optimistic local echo, before the
   * server has assigned it a real id — hides the unsend control until
   * there's something real to delete. */
  pending?: boolean;
  isLastInRun?: boolean;
  /** Group threads only — the sender's name, shown once above the first
   * bubble of a consecutive run from someone else. Undefined in dm
   * threads (redundant there) and on every bubble but the first in a run. */
  senderName?: string;
}) {
  return (
    // max-w-[75%] lives here, NOT on the bubble div below — this outer div
    // is a plain block box (a normal child of ChatThread's non-flex message
    // list), so the percentage resolves against a real, definite width.
    // It used to sit on the bubble div itself, but that div is a flex item
    // inside the "group flex" row below, and once this wrapper became
    // `flex flex-col items-start/items-end` (to stack the sender-name label
    // above the bubble), that made the row's own width indeterminate
    // (align-items other than the default `stretch` shrinks a flex item to
    // its content). A `max-width: 75%` resolving against an indeterminate
    // ancestor is undefined per spec, and in practice collapsed short,
    // space-less content (e.g. "Hi") to a single character per line: with
    // `overflow-wrap: break-word` set, a browser's min-content fallback for
    // an unbreakable run is just its narrowest character, and that's what
    // the box shrank to. Longer messages hid the bug — they have spaces,
    // real wrap points, so their min-content is a whole word, not one
    // glyph. Confirmed live (two throwaway accounts, a 2-char group
    // message) before and after this fix.
    <div className={cn("flex max-w-[75%] flex-col", isOwn ? "ml-auto items-end" : "items-start")}>
      {senderName && (
        <span className="mb-0.5 px-1 text-xs font-medium text-muted-foreground">{senderName}</span>
      )}
      <div className={cn("group flex items-center gap-1.5", isOwn ? "justify-end" : "justify-start")}>
        {isOwn && !pending && (
          <form
            action={deleteMessage.bind(null, message.id)}
            onSubmit={(e) => {
              if (!confirm("Unsend this message?")) e.preventDefault();
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100"
          >
            <button
              type="submit"
              aria-label="Unsend message"
              title="Unsend message"
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        )}
        <div
          // timeAgo, not toLocaleString — a locale/timezone-formatted string
          // renders differently on the server (Node's environment locale)
          // than on the client (the browser's), which is a real hydration
          // mismatch for any message loaded via the page's initial render.
          // timeAgo's rounded relative value doesn't have that problem.
          title={timeAgo(message.created_at)}
          className={cn(
            "rounded-2xl px-4 py-2 text-sm",
            isOwn
              ? cn("bg-primary text-primary-foreground", isLastInRun && "rounded-br-sm")
              : cn("bg-muted text-foreground", isLastInRun && "rounded-bl-sm"),
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
