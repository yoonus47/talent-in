"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { submitDailyChallenge } from "@/lib/actions/challenge";
import { Card } from "@/components/ui/card";
import type { DailyChallengeQuestion, DailyChallengeResult } from "@/lib/types/database";

export function DailyChallenge({ questions }: { questions: DailyChallengeQuestion[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<DailyChallengeResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const question = questions[step];
  const isLast = step === questions.length - 1;

  function selectOption(index: number) {
    const nextAnswers = { ...answers, [question.id]: index };
    setAnswers(nextAnswers);

    if (!isLast) {
      setStep(step + 1);
      return;
    }

    startTransition(async () => {
      const payload = Object.entries(nextAnswers).map(([question_id, selected_index]) => ({
        question_id,
        selected_index,
      }));
      const res = await submitDailyChallenge(payload);
      setResult(res);
    });
  }

  if (isPending) {
    return <Card className="p-8 text-center text-sm text-muted-foreground">Grading…</Card>;
  }

  if (result) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold">
          You got {result.score} / {result.total} 🎉
        </h2>
        <div className="mt-4 space-y-2.5">
          {questions.map((q) => {
            const graded = result.results.find((r) => r.question_id === q.id);
            return (
              <div key={q.id} className="flex items-start gap-2 text-sm">
                {graded?.correct ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="text-foreground">{q.question}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Come back tomorrow for a new challenge.
        </p>
      </Card>
    );
  }

  if (!question) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No challenge questions yet — run{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">supabase/seed.sql</code> against your
        project.
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {question.subject}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Question {step + 1} of {questions.length}
      </p>
      <h2 className="mt-2 text-base font-semibold">{question.question}</h2>
      <div className="mt-4 space-y-2">
        {question.options.map((option, index) => (
          <button
            key={option}
            onClick={() => selectOption(index)}
            className="block w-full rounded-lg border border-border px-4 py-3 text-left text-sm hover:border-primary hover:bg-primary/5"
          >
            {option}
          </button>
        ))}
      </div>
    </Card>
  );
}
