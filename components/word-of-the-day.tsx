"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Volume2 } from "lucide-react";
import type { VocabularyWord } from "@/lib/types/database";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The "learn" half of the vocabulary feature — pure reading, no scoring.
 * The word, its phonetic spelling, and a pronunciation button are always
 * visible ("hear it before you're quizzed"); tapping the strip below
 * reveals the definition and example, Duolingo-style. Phonetic + audio
 * come from scripts/enrich-vocabulary.mjs (Free Dictionary API, re-hosted
 * in our own Storage) and are simply absent — no broken button — when a
 * word hasn't been enriched or the API had nothing for it.
 */
export function WordOfTheDay({ word }: { word: VocabularyWord }) {
  const [revealed, setRevealed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!revealed) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [revealed]);

  function playPronunciation() {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    // .play() rejects on iOS in some states — swallow it so the click just
    // doesn't animate, rather than throwing an unhandled rejection.
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col items-center gap-2 px-6 pb-5 pt-8 text-center">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Word of the Day
        </span>
        <span className="brand-gradient-text text-3xl font-extrabold">{word.word}</span>

        {(word.phonetic || word.audio_url) && (
          <div className="flex items-center gap-2">
            {word.phonetic && (
              <span className="font-mono text-sm text-muted-foreground">{word.phonetic}</span>
            )}
            {word.audio_url && (
              <button
                type="button"
                onClick={playPronunciation}
                aria-label={`Hear ${word.word} pronounced`}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted",
                  playing && "bg-muted text-foreground",
                )}
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {word.audio_url && (
          <audio
            ref={audioRef}
            src={word.audio_url}
            preload="auto"
            className="hidden"
            onEnded={() => setPlaying(false)}
            onPause={() => setPlaying(false)}
          />
        )}
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full border-t border-border px-6 py-3 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
        >
          Tap to reveal meaning
        </button>
      ) : (
        <div
          className={cn(
            "space-y-2 border-t border-border px-6 py-4 transition-all duration-300",
            mounted ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
          )}
        >
          <Badge variant="accent">{word.part_of_speech}</Badge>
          <p className="text-sm font-medium text-foreground">{word.definition}</p>
          <p className="text-sm italic text-muted-foreground">
            &ldquo;{word.example_sentence}&rdquo;
          </p>
          {word.source_url && (
            <p className="pt-1 text-[11px] text-muted-foreground">
              Pronunciation from{" "}
              <a
                href={word.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Wiktionary
              </a>{" "}
              (CC BY-SA)
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
