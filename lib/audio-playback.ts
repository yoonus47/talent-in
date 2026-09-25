"use client";

/**
 * Playback-side coordination shared by every <AudioPlayer> instance
 * (components/audio-player.tsx) in a chat thread — two unrelated problems
 * that both need something living outside any single player, so one small
 * module instead of two.
 *
 * 1. iOS Safari can silently suspend the page's shared audio session after
 *    the tab has been backgrounded or sat idle for a while: a later
 *    audio.play() call still resolves and currentTime still advances (so
 *    the UI looks like it's playing), but no sound actually comes out —
 *    this is exactly "I hit play, the progress bar moves, but I can't
 *    hear it." Creating (or resuming) an AudioContext synchronously
 *    inside the same user-gesture handler that starts playback
 *    reactivates that shared session before the <audio> element's own
 *    play() runs — a well-known WebKit quirk, not something an <audio>
 *    element's own events can detect or recover from on their own.
 * 2. Only one voice message should ever be audible at once — tapping a
 *    second bubble while another is still playing pauses the first, the
 *    same as every other voice-message chat app.
 */

let sharedContext: AudioContext | null = null;

export function unlockAudioPlayback() {
  if (typeof window === "undefined") return;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  if (!sharedContext) {
    try {
      sharedContext = new Ctor();
    } catch {
      return;
    }
  }
  if (sharedContext.state === "suspended") {
    sharedContext.resume().catch(() => {});
  }
}

type PlayerEntry = { token: symbol; stop: () => void };
const players = new Set<PlayerEntry>();
let activeToken: symbol | null = null;

/** Call right before starting playback, with a token unique to this
 * player instance — pauses whichever other player was previously playing. */
export function claimExclusivePlayback(token: symbol) {
  if (activeToken && activeToken !== token) {
    for (const player of players) {
      if (player.token === activeToken) player.stop();
    }
  }
  activeToken = token;
}

/** Registers a player so claimExclusivePlayback can pause it later.
 * Returns an unregister function for cleanup on unmount. */
export function registerAudioPlayer(token: symbol, stop: () => void) {
  const entry: PlayerEntry = { token, stop };
  players.add(entry);
  return () => {
    players.delete(entry);
    if (activeToken === token) activeToken = null;
  };
}
