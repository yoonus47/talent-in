"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { VocabularyWord } from "@/lib/types/database";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The "learn" half of the vocabulary feature — pure reading, no scoring.
 * Shows just the word first; tapping reveals the definition and example,
 * Duolingo-style ("here's something new" before "now use it"), which the
 * vocabulary-subject daily challenge questions build on separately.
 */
export function WordOfTheDay({ word }: { word: VocabularyWord }) {
  const [revealed, setRevealed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [revealed]);

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setRevealed(true)}
        disabled={revealed}
        className={cn(
          "flex w-full flex-col items-center gap-2 px-6 py-8 text-center transition-colors",
          !revealed && "cursor-pointer hover:bg-muted/50",
        )}
      >
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Word of the Day
        </span>
        <span className="ig-gradient-text text-3xl font-extrabold">{word.word}</span>
        {!revealed && (
          <span className="mt-1 text-xs text-muted-foreground">Tap to reveal meaning</span>
        )}
      </button>

      {revealed && (
        <div
          className={cn(
            "space-y-2 border-t border-border px-6 py-4 transition-all duration-300",
            mounted ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
          )}
        >
          <Badge variant="accent">{word.part_of_speech}</Badge>
          <p className="text-sm font-medium text-foreground">{word.definition}</p>
          <p className="text-sm italic text-muted-foreground">&ldquo;{word.example_sentence}&rdquo;</p>
        </div>
      )}
    </Card>
  );
}
