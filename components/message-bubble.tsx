"use client";

import { useState } from "react";
import { Check, CheckCheck, Copy, Reply, Trash2 } from "lucide-react";
import { deleteMessage } from "@/lib/actions/chat";
import { AudioPlayer } from "@/components/audio-player";
import { MessageText } from "@/components/message-text";
import { MessageActionMenu, type MessageMenuItem } from "@/components/message-action-menu";
import { cn, timeAgo } from "@/lib/utils";
import type { Message } from "@/lib/types/database";

export type MessageStatus = "pending" | "sent" | "read";

/** WhatsApp-style status icon for one of MY OWN messages — a single check
 * while still sending, a double check once confirmed, and a double check
 * in --read-receipt (app/globals.css — its own theme-aware accent, tuned
 * to actually contrast against an own-message bubble in *either* theme,
 * not a literal copy of WhatsApp's blue) once every other participant's
 * read-marker has caught up (dm: the one other person; group: everyone
 * else currently in it — see ChatThread's messageStatus). Only ever
 * rendered on an own/bg-primary bubble, so the dim states use
 * primary-foreground, not a generic muted token, to stay visible against
 * that background. */
function MessageStatusIcon({ status }: { status: MessageStatus }) {
  if (status === "pending") {
    return <Check className="h-3.5 w-3.5 shrink-0 text-primary-foreground/50" />;
  }
  if (status === "read") {
    return <CheckCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--read-receipt)" }} />;
  }
  return <CheckCheck className="h-3.5 w-3.5 shrink-0 text-primary-foreground/60" />;
}

/** The small quoted block shown above a message's own content when it's a
 * reply — rendered straight from the reply_to_* snapshot columns (server-
 * computed by the insert trigger, see supabase/migrations/0026_chat_reply_
 * and_mentions.sql), never a live lookup. "You" is resolved here, at
 * render time, from the viewer's own id — a stored snapshot can't say
 * "You" to the right person for every viewer at once. Deliberately NOT
 * clickable/scroll-to-original (see the chat plan's v1 cuts) — only the
 * last 50 messages are ever loaded, so the original is frequently not
 * even on screen to jump to. */
function ReplyQuote({ message, myId, tone }: { message: Message; myId: string; tone: "own" | "other" }) {
  if (!message.reply_to_sender_name) return null;
  const label = message.reply_to_sender_id === myId ? "You" : message.reply_to_sender_name;
  const preview = message.reply_to_type === "voice" ? "🎤 Voice message" : message.reply_to_preview;
  return (
    <div
      className={cn(
        "mb-1 rounded-lg border-l-2 px-2 py-1 text-xs",
        tone === "own"
          ? "border-primary-foreground/40 bg-primary-foreground/10 text-primary-foreground/80"
          : "border-primary/40 bg-foreground/5 text-muted-foreground",
      )}
    >
      <p className="font-medium">{label}</p>
      <p className="truncate">{preview}</p>
    </div>
  );
}

/** One message bubble — right-aligned/accent when it's mine, with a
 * "⋯" actions menu (Reply / Copy / Unsend) that replaces what used to be
 * a hover-only unsend button (confirmed live to be unusable on touch —
 * see components/message-action-menu.tsx). Bubbles from the same sender
 * in a row are visually grouped: only the *last* bubble in a run gets the
 * tail corner, and a group thread shows the sender's name once, above the
 * first bubble in a run — see ChatThread's run-detection for how
 * `isLastInRun`/`senderName` are computed. */
export function MessageBubble({
  message,
  myId,
  isOwn,
  pending = false,
  isLastInRun = true,
  senderName,
  status,
  onReply,
}: {
  message: Message;
  /** Needed to resolve "You" in a reply quote's label — see ReplyQuote. */
  myId: string;
  isOwn: boolean;
  /** True while the message is still an optimistic local echo, before the
   * server has assigned it a real id — hides Reply/Unsend until there's a
   * real row to act on (a temp- id isn't a valid uuid to reply to). */
  pending?: boolean;
  isLastInRun?: boolean;
  /** Group threads only — the sender's name, shown once above the first
   * bubble of a consecutive run from someone else. Undefined in dm
   * threads (redundant there) and on every bubble but the first in a run. */
  senderName?: string;
  /** Own messages only — undefined for anyone else's (see ChatThread's
   * messageStatus). Renders the WhatsApp-style check/checkmark. */
  status?: MessageStatus;
  /** Opens the reply-preview strip in the composer for this message. */
  onReply?: (message: Message) => void;
}) {
  const [showTime, setShowTime] = useState(false);
  const tone = isOwn ? "own" : "other";

  const items: MessageMenuItem[] = [];
  if (!pending) {
    items.push({ key: "reply", label: "Reply", icon: Reply, onClick: () => onReply?.(message) });
    if (message.type === "text" && message.content) {
      items.push({
        key: "copy",
        label: "Copy text",
        icon: Copy,
        onClick: () => navigator.clipboard.writeText(message.content ?? "").catch(() => {}),
      });
    }
    if (isOwn) {
      items.push({
        key: "unsend",
        label: "Unsend",
        icon: Trash2,
        destructive: true,
        onClick: () => {
          if (confirm("Unsend this message?")) deleteMessage(message.id);
        },
      });
    }
  }

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
        {isOwn && <MessageActionMenu items={items} align="end" />}
        <div
          onClick={() => setShowTime((v) => !v)}
          // timeAgo, not toLocaleString — a locale/timezone-formatted string
          // renders differently on the server (Node's environment locale)
          // than on the client (the browser's), which is a real hydration
          // mismatch for any message loaded via the page's initial render.
          // timeAgo's rounded relative value doesn't have that problem.
          // The title attribute is a harmless desktop-hover fallback for
          // the same value — the actual fix for "invisible on touch" is
          // the tap-driven showTime caption below the bubble.
          title={timeAgo(message.created_at)}
          className={cn(
            "cursor-pointer select-none rounded-2xl px-4 py-2 text-sm",
            isOwn
              ? cn("bg-primary text-primary-foreground", isLastInRun && "rounded-br-sm")
              : cn("bg-muted text-foreground", isLastInRun && "rounded-bl-sm"),
          )}
        >
          <ReplyQuote message={message} myId={myId} tone={tone} />
          {message.type === "voice" && message.audio_url ? (
            <div onClick={(e) => e.stopPropagation()}>
              <AudioPlayer src={message.audio_url} durationMs={message.duration_ms ?? 0} tone={tone} />
            </div>
          ) : (
            <MessageText content={message.content ?? ""} tone={tone} />
          )}
          {isOwn && status && (
            <div className="mt-0.5 flex justify-end">
              <MessageStatusIcon status={status} />
            </div>
          )}
        </div>
        {!isOwn && <MessageActionMenu items={items} align="start" />}
      </div>
      {showTime && (
        <span className="mt-0.5 px-1 text-[11px] text-muted-foreground">{timeAgo(message.created_at)}</span>
      )}
    </div>
  );
}
