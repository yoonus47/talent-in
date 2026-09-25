"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Pause, Play } from "lucide-react";
import { claimExclusivePlayback, registerAudioPlayer, unlockAudioPlayback } from "@/lib/audio-playback";
import { cn } from "@/lib/utils";

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Play/pause + click-to-seek progress bar + duration — no waveform (a
 * deliberate scope cut). Shared between a voice message bubble
 * (components/message-bubble.tsx) and the recorder's pre-send preview
 * (components/voice-recorder.tsx) — deliberately NOT the browser's native
 * `<audio controls>` widget, whose width and layout vary unpredictably
 * across browsers. That inconsistency was the real cause of the recorder
 * preview looking "broken" next to the send button — a fully custom,
 * fixed-width control sidesteps it entirely and looks the same everywhere.
 *
 * `durationMs` is the value recorded client-side and stored on the row —
 * used as the initial/fallback label before the <audio> element's own
 * metadata loads.
 */
export function AudioPlayer({
  src,
  durationMs,
  tone = "neutral",
}: {
  src: string;
  durationMs: number;
  /** "own"/"other" match a message bubble's two-tone background; "neutral"
   * is for contexts with no colored bubble behind it (the recorder preview). */
  tone?: "own" | "other" | "neutral";
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [broken, setBroken] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(durationMs);
  // One per mounted player, stable for its lifetime — lib/audio-playback's
  // exclusive-playback registry uses this to know which <audio> element a
  // given "pause everyone else" request refers to.
  const tokenRef = useRef(Symbol("audio-player"));

  useEffect(() => {
    return registerAudioPlayer(tokenRef.current, () => audioRef.current?.pause());
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    // Order matters: unlock (which can synchronously create/resume an
    // AudioContext) and claim exclusivity BEFORE play() — both need to run
    // inside this same click's user-gesture window, and pausing another
    // player after this one has already started would cause an audible
    // double-play overlap for a frame.
    unlockAudioPlayback();
    claimExclusivePlayback(tokenRef.current);
    setBroken(false);
    audio.play().catch(() => setBroken(true));
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    setCurrentMs(ratio * audio.duration * 1000);
  }

  // Arrow-key seeking, mirroring what a native <input type="range"> gives
  // for free — this is a plain div (role="slider" for the click-to-seek
  // behavior above), so keyboard support isn't automatic.
  function handleSeekKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const deltaSeconds = e.key === "ArrowRight" ? 5 : -5;
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + deltaSeconds));
    setCurrentMs(audio.currentTime * 1000);
  }

  const progress = totalMs > 0 ? Math.min(1, currentMs / totalMs) : 0;

  return (
    <div className="flex w-48 items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-label={broken ? "Couldn't play. Try again" : playing ? "Pause" : "Play"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90",
          tone === "own" && "bg-primary-foreground/20 hover:bg-primary-foreground/30",
          tone === "other" && "bg-foreground/10 hover:bg-foreground/15",
          tone === "neutral" && "bg-primary text-primary-foreground hover:bg-primary-hover",
        )}
      >
        {buffering ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : broken ? (
          <AlertCircle className="h-3.5 w-3.5" />
        ) : playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5 translate-x-0.5" />
        )}
      </button>
      <div
        onClick={seek}
        onKeyDown={handleSeekKeyDown}
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className={cn(
          "h-1.5 flex-1 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          tone === "own" && "bg-primary-foreground/30",
          tone === "other" && "bg-foreground/20",
          tone === "neutral" && "bg-muted",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full",
            !playing && "transition-[width] duration-150",
            tone === "own" && "bg-primary-foreground",
            tone === "other" && "bg-foreground",
            tone === "neutral" && "bg-primary",
          )}
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
        onPlay={() => {
          setPlaying(true);
          setBroken(false);
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrentMs(0);
        }}
        onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration)) setTotalMs(e.currentTarget.duration * 1000);
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={() => {
          setBuffering(false);
          setBroken(true);
        }}
        className="hidden"
      />
    </div>
  );
}
