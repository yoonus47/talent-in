"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { QuizFlow } from "@/components/quiz-flow";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QuizQuestion, QuizResult } from "@/lib/types/database";

/**
 * The career quiz, inline on /dashboard — it used to be its own /quiz
 * page/nav tab; that nav slot is now Community (lib/nav-links.ts), and
 * "no need a separate page for that" meant folding the actual quiz-taking
 * flow (components/quiz-flow.tsx, unchanged) directly into this card
 * instead of just linking out to it.
 *
 * QuizFlow already owns its full step-through-then-result-then-retake
 * lifecycle internally — this wrapper only adds the collapsed/expanded
 * toggle around it, plus a `router.refresh()` on collapse so the summary
 * reflects a just-submitted result (QuizFlow's own result view shows the
 * fresh one immediately; without a refresh here, going back to the
 * summary would still show the *old* `quizResult` prop from the initial
 * server render — same "refresh after a mutation" pattern components/
 * group-info-panel.tsx already uses).
 */
export function CareerQuizCard({
  questions,
  quizResult,
}: {
  questions: QuizQuestion[];
  quizResult: QuizResult | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  function collapse() {
    setExpanded(false);
    router.refresh();
  }

  if (expanded) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={collapse} className="mb-2 -ml-2">
          <ChevronLeft className="h-4 w-4" />
          Done
        </Button>
        <QuizFlow questions={questions} />
      </div>
    );
  }

  return (
    <Card className="p-6">
      {quizResult ? (
        <>
          <p className="text-sm text-muted-foreground">Your latest result:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {quizResult.suggested_streams.map((stream) => (
              <Badge key={stream} variant="accent">
                {stream}
              </Badge>
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          You haven&apos;t taken the career quiz yet.
        </p>
      )}
      <Button variant="outline" size="sm" className="mt-4" onClick={() => setExpanded(true)}>
        {quizResult ? "Retake quiz" : "Take the quiz"}
      </Button>
    </Card>
  );
}
