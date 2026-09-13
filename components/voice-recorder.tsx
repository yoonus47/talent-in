"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Send, Trash2, X } from "lucide-react";
import { VoiceRecorder as Recorder, getSupportedMimeType } from "@/lib/audio-client";
import { cn } from "@/lib/utils";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 639px)"; // matches Tailwind's `sm` breakpoint
const CANCEL_DRAG_PX = 60; // drag this far up while holding to cancel instead of send

// useSyncExternalStore, not useState+useEffect — this is a browser-only
// API (matchMedia doesn't exist during SSR), and its getServerSnapshot
// argument is exactly the mechanism React provides for "render a safe
// default on the server, without a hydration mismatch, then subscribe to
// the real value on the client." The only place this value visibly
// affects markup is a tooltip's title text and text that only ever
// appears after a real (client-only) recording-state transition, so a
// "renders as desktop, then possibly flips" first paint is unnoticeable.
function subscribeToViewport(callback: () => void) {
  const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function getViewportSnapshot() {
  return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
}
function getServerViewportSnapshot() {
  return false;
}

function useIsMobile() {
  return useSyncExternalStore(subscribeToViewport, getViewportSnapshot, getServerViewportSnapshot);
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Live amplitude meter — a handful of bars reacting to the mic level, not
 * a real waveform (a deliberate v1 scope cut, see the voice-messages plan). */
function LevelMeter({ level }: { level: number }) {
  const bars = [0.6, 1, 0.8, 1, 0.6];
  return (
    <div className="flex h-5 items-center gap-0.5">
      {bars.map((mult, i) => (
        <span
          key={i}
          className="w-1 rounded-full bg-destructive transition-all duration-75"
          style={{ height: `${Math.max(15, level * 100 * mult)}%` }}
        />
      ))}
    </div>
  );
}

/**
 * The mic control that replaces the send button when the composer is
 * empty (WhatsApp's convention). Behavior deliberately differs by device,
 * per the user's own call: mobile holds the phone one-handed and expects
 * true hold-to-talk (release = send immediately, drag up = cancel);
 * desktop has a free hand and a mouse, so a safer tap → stop → preview →
 * send/discard flow fits better there (no fighting a press-and-hold
 * gesture with a pointer).
 */
export function VoiceRecorderButton({
  onSend,
  onActiveChange,
  disabled,
}: {
  onSend: (blob: Blob, mimeType: string, durationMs: number) => void;
  /** Fires whenever recording/preview starts or ends, so the composer can
   * hide the text input while this control expands to fill its place. */
  onActiveChange?: (active: boolean) => void;
  disabled?: boolean;
}) {
  const isMobile = useIsMobile();
  const [phase, setPhaseState] = useState<"idle" | "recording" | "cancel-zone" | "preview">("idle");
  const setPhase = (next: "idle" | "recording" | "cancel-zone" | "preview") => {
    setPhaseState((prev) => {
      const wasActive = prev !== "idle";
      const isActive = next !== "idle";
      if (wasActive !== isActive) onActiveChange?.(isActive);
      return next;
    });
  };
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; mimeType: string; durationMs: number; url: string } | null>(
    null,
  );

  const recorderRef = useRef<Recorder | null>(null);
  const startYRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      recorderRef.current?.cancel();
      if (preview) URL.revokeObjectURL(preview.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tickLevel() {
    if (recorderRef.current) setLevel(recorderRef.current.getLevel());
    rafRef.current = requestAnimationFrame(tickLevel);
  }

  async function beginRecording() {
    setError(null);
    if (!getSupportedMimeType()) {
      setError("Voice messages aren't supported in this browser.");
      return;
    }
    try {
      const recorder = new Recorder();
      recorderRef.current = recorder;
      await recorder.start(() => {
        // Auto-stop at MAX_RECORDING_MS — treat it the same as a manual stop.
        finishRecording();
      });
      setPhase("recording");
      setElapsedMs(0);
      const startedAt = Date.now();
      elapsedTimerRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 200);
      rafRef.current = requestAnimationFrame(tickLevel);
    } catch {
      setError("Couldn't access the microphone — check your browser's permission for this site.");
    }
  }

  function stopTimers() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    rafRef.current = null;
    elapsedTimerRef.current = null;
  }

  async function finishRecording() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    stopTimers();
    const result = await recorder.stop();
    recorderRef.current = null;

    if (result.durationMs < 500) {
      // Too short to be a real message (an accidental tap) — just discard.
      setPhase("idle");
      return;
    }

    if (isMobile) {
      onSend(result.blob, result.mimeType, result.durationMs);
      setPhase("idle");
    } else {
      setPreview({ blob: result.blob, mimeType: result.mimeType, durationMs: result.durationMs, url: URL.createObjectURL(result.blob) });
      setPhase("preview");
    }
  }

  function cancelRecording() {
    stopTimers();
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setPhase("idle");
  }

  function discardPreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setPhase("idle");
  }

  function sendPreview() {
    if (!preview) return;
    onSend(preview.blob, preview.mimeType, preview.durationMs);
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    setPhase("idle");
  }

  // ── mobile: press-and-hold, drag up to cancel ───────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    if (!isMobile || disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startYRef.current = e.clientY;
    beginRecording();
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!isMobile || (phase !== "recording" && phase !== "cancel-zone")) return;
    const draggedUp = startYRef.current - e.clientY;
    setPhase(draggedUp > CANCEL_DRAG_PX ? "cancel-zone" : "recording");
  }
  function onPointerUp() {
    if (!isMobile) return;
    if (phase === "cancel-zone") cancelRecording();
    else if (phase === "recording") finishRecording();
  }

  // ── desktop: tap to start, tap to stop ──────────────────────────────────
  function onClick() {
    if (isMobile || disabled) return;
    if (phase === "idle") beginRecording();
    else if (phase === "recording") finishRecording();
  }

  if (phase === "preview" && preview) {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <audio src={preview.url} controls className="h-8 flex-1" />
        <span className="shrink-0 text-xs text-muted-foreground">{formatDuration(preview.durationMs)}</span>
        <button
          type="button"
          onClick={discardPreview}
          aria-label="Discard recording"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={sendPreview}
          aria-label="Send voice message"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (phase === "recording" || phase === "cancel-zone") {
    return (
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
        <span className="shrink-0 text-sm tabular-nums text-foreground">{formatDuration(elapsedMs)}</span>
        <LevelMeter level={level} />
        <span className={cn("flex-1 truncate text-right text-xs", phase === "cancel-zone" ? "font-medium text-destructive" : "text-muted-foreground")}>
          {isMobile
            ? phase === "cancel-zone"
              ? "Release to cancel"
              : "Slide up to cancel"
            : "Recording… tap the mic to stop"}
        </span>
        {!isMobile && (
          <button
            type="button"
            onClick={cancelRecording}
            aria-label="Cancel recording"
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label="Stop recording"
          className={cn(
            "flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-full text-white",
            phase === "cancel-zone" ? "bg-muted-foreground" : "bg-destructive",
          )}
        >
          <Mic className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        disabled={disabled}
        aria-label="Record a voice message"
        title={isMobile ? "Hold to record" : "Tap to record"}
        className="flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        <Mic className="h-4 w-4" />
      </button>
      {error && <p className="mt-1 max-w-[10rem] text-right text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

