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
    <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
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
            "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
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
