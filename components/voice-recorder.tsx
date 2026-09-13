"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Send, Square, Trash2 } from "lucide-react";
import { VoiceRecorder as Recorder, getSupportedMimeType } from "@/lib/audio-client";
import { AudioPlayer } from "@/components/audio-player";

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Live amplitude meter — a handful of bars reacting to the mic level, not
 * a real waveform (a deliberate scope cut). */
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
 * empty. One interaction on every device — tap to start, tap to stop,
 * review, then send or discard — deliberately not press-and-hold.
 *
 * An earlier version tried hold-to-talk on mobile: press-and-hold starts
 * recording, release sends. Confirmed live that this fights the browser —
 * holding a pointer down without suppressing the default drag-select
 * gesture made the browser start a text selection instead of recording,
 * and a mouse has no real equivalent of a touch long-press to begin with
 * (a click is instantaneous; there's no native "hold" gesture to hook).
 * A plain tap has none of that fragility, needs no pointer-capture or
 * drag-cancel-zone logic, and behaves identically with a mouse, trackpad,
 * or finger — simpler and considerably more robust for one interaction
 * that has to work everywhere.
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
  const [phase, setPhaseState] = useState<"idle" | "recording" | "preview">("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; mimeType: string; durationMs: number; url: string } | null>(
    null,
  );

  const recorderRef = useRef<Recorder | null>(null);
  const rafRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setPhase = setPhaseState;

  // Notifying the parent belongs in an effect, not inside the state
  // updater above (which is what this replaced) — calling a different
  // component's setState from within another component's updater function
  // runs during React's render phase and triggers "Cannot update a
  // component while rendering a different component" (confirmed live via
  // the console). An effect fires after render, which is the correct time
  // to synchronize an external component with this one's derived state.
  useEffect(() => {
    onActiveChange?.(phase !== "idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

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
      // Auto-stop at the 2-minute cap is treated the same as a manual stop.
      await recorder.start(() => finishRecording());
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
    setPreview({
      blob: result.blob,
      mimeType: result.mimeType,
      durationMs: result.durationMs,
      url: URL.createObjectURL(result.blob),
    });
    setPhase("preview");
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

  function handleMicClick() {
    if (disabled) return;
    if (phase === "idle") beginRecording();
    else if (phase === "recording") finishRecording();
  }

  if (phase === "preview" && preview) {
    return (
      <div className="flex flex-1 select-none items-center gap-1.5 rounded-lg border border-border bg-card py-1.5 pl-1.5 pr-2">
        <button
          type="button"
          onClick={discardPreview}
          aria-label="Discard recording"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <AudioPlayer src={preview.url} durationMs={preview.durationMs} tone="neutral" />
        <button
          type="button"
          onClick={sendPreview}
          aria-label="Send voice message"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <div className="flex flex-1 select-none items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
        <span className="shrink-0 text-sm tabular-nums text-foreground">{formatDuration(elapsedMs)}</span>
        <LevelMeter level={level} />
        <span className="flex-1" />
        <button
          type="button"
          onClick={cancelRecording}
          aria-label="Cancel recording"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleMicClick}
          aria-label="Stop recording"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive text-white"
        >
          <Square className="h-3 w-3" fill="currentColor" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end">
      <button
        type="button"
        onClick={handleMicClick}
        disabled={disabled}
        aria-label="Record a voice message"
        title="Record a voice message"
        className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        <Mic className="h-4 w-4" />
      </button>
      {error && <p className="mt-1 max-w-[10rem] text-right text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
