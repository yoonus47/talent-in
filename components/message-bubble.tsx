"use client";

import { useState } from "react";
import { Check, CheckCheck, Clock, Copy, Info, Reply, Trash2 } from "lucide-react";
import { deleteMessage } from "@/lib/actions/chat";
import { AudioPlayer } from "@/components/audio-player";
import { MessageText } from "@/components/message-text";
import { MessageActionMenu, type MessageMenuItem } from "@/components/message-action-menu";
import { Avatar } from "@/components/ui/avatar";
import { cn, timeAgo } from "@/lib/utils";
import type { Message } from "@/lib/types/database";

export type MessageStatus = "pending" | "sent" | "delivered" | "read";

/** WhatsApp-style status icon for one of MY OWN messages — the real 4-tick
 * ladder: a clock while still sending, a single check once the server has
 * confirmed it, a double check once every other relevant participant's
 * device has it (conversation_deliveries), and a double check in
 * --read-receipt (app/globals.css — its own theme-aware accent, tuned to
 * actually contrast against an own-message bubble in *either* theme, not
 * a literal copy of WhatsApp's blue) once every one of them has actually
 * read it — see ChatThread's messageStatus for exactly what "every"
 * means for a dm vs a group. Only ever rendered on an own/bg-primary
 * bubble, so the dim states use primary-foreground, not a generic muted
 * token, to stay visible against that background. */
function MessageStatusIcon({ status }: { status: MessageStatus }) {
  if (status === "pending") {
    return <Clock className="h-3.5 w-3.5 shrink-0 text-primary-foreground/50" />;
  }
  if (status === "sent") {
    return <Check className="h-3.5 w-3.5 shrink-0 text-primary-foreground/60" />;
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
 * "⋯" actions menu (Reply / Copy / Unsend / Message info) that replaces
 * what used to be a hover-only unsend button (confirmed live to be
 * unusable on touch — see components/message-action-menu.tsx). Bubbles
 * from the same sender in a row are visually grouped: only the *last*
 * bubble in a run gets the tail corner, and a group thread shows the
 * sender's name once, above the *first* bubble in a run, and their
 * avatar once, on the *last* one — see ChatThread's run-detection for how
 * `isLastInRun`/`senderName`/`senderProfile` are computed. */
export function MessageBubble({
  message,
  myId,
  isOwn,
  pending = false,
  isLastInRun = true,
  senderName,
  senderProfile,
  status,
  onReply,
  onShowInfo,
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
  /** Group threads only, on EVERY bubble of a non-own run (not just the
   * last) — its presence reserves the avatar column's width consistently
   * across the whole run, so every bubble left-aligns the same regardless
   * of which one actually shows the circle (that used to only be sent on
   * the last bubble, which left every other bubble in a multi-message run
   * with no column at all — a real, confirmed 36px left-edge misalignment
   * within a single run). The actual `<Avatar>` only renders when
   * `isLastInRun` (the tail-corner bubble); the other bubbles just get an
   * equal-width blank spacer. */
  senderProfile?: { full_name: string; avatar_url: string | null };
  /** Own messages only — undefined for anyone else's (see ChatThread's
   * messageStatus). Renders the WhatsApp-style check/checkmark. */
  status?: MessageStatus;
  /** Opens the reply-preview strip in the composer for this message. */
  onReply?: (message: Message) => void;
  /** Group threads, own messages only — opens the read-by/delivered-to
   * breakdown (components/message-info-panel.tsx). Undefined in dm
   * threads, where the checkmark alone already says everything (matching
   * WhatsApp's own choice not to offer this on 1:1 chats). */
  onShowInfo?: (message: Message) => void;
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
    if (isOwn && onShowInfo) {
      items.push({ key: "info", label: "Message info", icon: Info, onClick: () => onShowInfo(message) });
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
    // w-fit is load-bearing, not decorative — without it this row (still
    // `display:flex`, hence still block-level) defaults to *filling* its
    // containing block's width the same as any plain block box with
    // `width: auto` would, and max-w-[75%] only caps that fill, it
    // doesn't make the box shrink to its own content. The visible result,
    // confirmed live via getBoundingClientRect on real messages of
    // different lengths: every own-message row was silently exactly 75%
    // wide regardless of the bubble's actual text, with the bubble+"⋯"
    // trigger left-packed (default justify-content: flex-start) inside
    // that oversized box rather than hugging its true right edge — so
    // ml-auto below was pushing a consistently oversized invisible box to
    // the right, while the actually-visible bubble sat wherever that
    // box's own left edge happened to land, landing at the *identical* x
    // position for three own bubbles of very different widths instead of
    // tracking each one's real content. `w-fit` (width: fit-content)
    // makes the row shrink to its content first, with max-w-[75%] still
    // acting as a hard ceiling (forcing a wrap) only once real content
    // would exceed it — the same semantics the row visually had before it
    // became a `flex` row (for the avatar column) rather than a
    // `flex-col` one (see the git history for that version, which got
    // this for free from `items-end`/`items-start` instead needing it
    // spelled out, since align-items there was doing double duty as the
    // width-fitting mechanism along what was then the cross axis).
    //
    // max-w-[75%] itself still lives on this row (avatar column + content
    // column together), not on the content column alone, so the avatar
    // sits outside that budget instead of stealing from the text's own
    // width. This row is still a plain block child of ChatThread's
    // non-flex (space-y-1) message list, so the *other*, earlier bug this
    // paragraph used to document — max-width on a flex ITEM whose OWN
    // container uses non-stretch align-items, which made short content
    // like "Hi" collapse to one character per line — doesn't apply here;
    // that was about an ANCESTOR being an indeterminate-width flex item,
    // not about this element itself using display:flex internally.
    <div className={cn("flex w-fit max-w-[75%] items-end gap-2", isOwn && "ml-auto")}>
      {senderProfile && (
        <div className="w-7 shrink-0 self-end">
          {isLastInRun && (
            <Avatar name={senderProfile.full_name} src={senderProfile.avatar_url} size={28} />
          )}
        </div>
      )}
      <div className={cn("flex min-w-0 flex-col", isOwn ? "items-end" : "items-start")}>
        {senderName && (
          <span className="mb-0.5 px-1 text-xs font-medium text-muted-foreground">{senderName}</span>
        )}
        {/* items-end, not items-center — a tall multi-line bubble used to
            leave the "⋯" trigger floating in the vertical middle of a lot
            of empty space, disconnected from anything. Anchoring to the
            bottom instead lines it up with the status icon/avatar, both
            already bottom-aligned, so hover/tap controls consistently
            cluster along the same edge regardless of bubble height. */}
        <div className={cn("group flex items-end gap-1.5", isOwn ? "justify-end" : "justify-start")}>
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
              "cursor-pointer select-none rounded-2xl px-4 py-2.5 text-base",
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
    </div>
  );
}
