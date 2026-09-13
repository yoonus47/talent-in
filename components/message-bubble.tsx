"use client";

import { useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { deleteMessage } from "@/lib/actions/chat";
import { cn, timeAgo } from "@/lib/utils";
import type { Message } from "@/lib/types/database";

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Play/pause + click-to-seek progress bar + duration — no waveform (a
 * deliberate v1 scope cut, see the voice-messages plan); `durationMs` is
 * the value recorded client-side and stored on the row, used as the
 * initial/fallback label before the <audio> element's own metadata loads. */
function VoicePlayer({ src, durationMs, isOwn }: { src: string; durationMs: number; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(durationMs);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setCurrentMs(ratio * audio.duration * 1000);
  }

  const progress = totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0;

  return (
    <div className="flex w-48 items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isOwn ? "bg-primary-foreground/20" : "bg-foreground/10",
        )}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-0.5" />}
      </button>
      <div
        onClick={seek}
        role="slider"
        aria-label="Seek"
        aria-valuenow={Math.round(progress * 100)}
        className={cn("h-1.5 flex-1 cursor-pointer rounded-full", isOwn ? "bg-primary-foreground/30" : "bg-foreground/20")}
      >
        <div
          className={cn("h-full rounded-full", isOwn ? "bg-primary-foreground" : "bg-foreground")}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums">
        {formatTime(playing || currentMs > 0 ? currentMs : totalMs)}
      </span>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentMs(0);
        }}
        onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration)) setTotalMs(e.currentTarget.duration * 1000);
        }}
        className="hidden"
      />
    </div>
  );
}

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
          {message.type === "voice" && message.audio_url ? (
            <VoicePlayer src={message.audio_url} durationMs={message.duration_ms ?? 0} isOwn={isOwn} />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>
      </div>
    </div>
  );
}
