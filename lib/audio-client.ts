/**
 * Browser-only voice-recording helpers — never import from lib/actions/*
 * or any other server code, it uses MediaRecorder/Web Audio APIs that
 * don't exist in Node. Mirrors lib/image-client.ts's role for photos.
 *
 * Bitrate/codec choice is deliberate, not arbitrary: 24kbps mono Opus is
 * the cheapest point on Opus's *fullband* speech tier (20kbps and below is
 * only wideband — a real, audible step down, not just fewer bits) and
 * costs a few dollars a month even at tens of thousands of MAU. Opus
 * requires Chrome/Firefox/Android; Safari/iOS's MediaRecorder only offers
 * 'audio/mp4' (AAC), whose bitrate isn't controllable the same precise
 * way — a known, accepted platform gap, not a bug.
 */

export const MAX_RECORDING_MS = 120_000; // 2 minutes — also enforced by messages.duration_ms's DB check
const TARGET_BITRATE = 24_000;

const CANDIDATE_MIME_TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];

export function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

/** Maps a MediaRecorder mimeType to a file extension for the Storage path
 * — deliberately not reusing lib/uploads.ts's extensionFor, which is
 * image-oriented (splits on "/" and would give "mp4" instead of the more
 * conventional "m4a" for AAC-in-MP4 audio). */
export function audioExtensionFor(mimeType: string): string {
  if (mimeType.startsWith("audio/webm")) return "webm";
  if (mimeType.startsWith("audio/ogg")) return "ogg";
  if (mimeType.startsWith("audio/mp4")) return "m4a";
  return "webm";
}

export type RecordingResult = { blob: Blob; mimeType: string; durationMs: number };

/**
 * One-shot recorder: start() begins capture (requesting mic permission if
 * needed), stop() ends it and resolves with the recorded blob. Auto-stops
 * at MAX_RECORDING_MS on its own — callers should still surface that as a
 * "max length reached" moment rather than a silent cutoff.
 */
export class VoiceRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: BlobPart[] = [];
  private startedAt = 0;
  private mimeType: string;
  private autoStopTimer: ReturnType<typeof setTimeout> | null = null;
  private stopPromise: Promise<RecordingResult> | null = null;
  private resolveStop: ((result: RecordingResult) => void) | null = null;

  // Web Audio nodes for the live level meter — torn down in cleanup().
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  constructor() {
    const mimeType = getSupportedMimeType();
    if (!mimeType) throw new Error("Voice recording isn't supported in this browser.");
    this.mimeType = mimeType;
  }

  async start(onAutoStop: () => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Live amplitude for the recording UI's level bar — not used for the
    // recording itself, just visual feedback.
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);

    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.mimeType,
      audioBitsPerSecond: TARGET_BITRATE,
    });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.startedAt = Date.now();
    this.mediaRecorder.start();

    this.autoStopTimer = setTimeout(() => {
      onAutoStop();
      this.stop();
    }, MAX_RECORDING_MS);
  }

  /** Current mic amplitude, 0-1 — poll this from a rAF loop while recording. */
  getLevel(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (const v of data) {
      const normalized = (v - 128) / 128;
      sumSquares += normalized * normalized;
    }
    return Math.min(1, Math.sqrt(sumSquares / data.length) * 4);
  }

  stop(): Promise<RecordingResult> {
    if (this.stopPromise) return this.stopPromise;

    this.stopPromise = new Promise((resolve) => {
      this.resolveStop = resolve;
    });

    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }

    const recorder = this.mediaRecorder;
    if (!recorder || recorder.state === "inactive") {
      this.finish();
      return this.stopPromise;
    }

    recorder.onstop = () => this.finish();
    recorder.stop();
    return this.stopPromise;
  }

  private finish() {
    const durationMs = Date.now() - this.startedAt;
    const blob = new Blob(this.chunks, { type: this.mimeType });
    this.cleanup();
    this.resolveStop?.({ blob, mimeType: this.mimeType, durationMs });
  }

  /** Discards the in-progress recording without resolving stop() —
   * releases the mic immediately (e.g. on drag-to-cancel). */
  cancel() {
    if (this.autoStopTimer) {
      clearTimeout(this.autoStopTimer);
      this.autoStopTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.onstop = null;
      this.mediaRecorder.stop();
    }
    this.cleanup();
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioContext?.close().catch(() => {});
    this.audioContext = null;
    this.analyser = null;
    this.mediaRecorder = null;
  }
}
