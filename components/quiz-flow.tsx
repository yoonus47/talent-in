"use client";

import { useState, useTransition } from "react";
import { submitQuizResult } from "@/lib/actions/quiz";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { QuizQuestion } from "@/lib/types/database";

export function QuizFlow({ questions }: { questions: QuizQuestion[] }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const question = questions[step];
  const isLast = step === questions.length - 1;

  function selectOption(label: string) {
    const nextAnswers = { ...answers, [question.id]: label };
    setAnswers(nextAnswers);

    if (isLast) {
      const tally = new Map<string, number>();
      for (const q of questions) {
        const chosenLabel = nextAnswers[q.id];
        const option = q.options.find((o) => o.label === chosenLabel);
        option?.streams.forEach((s) => tally.set(s, (tally.get(s) ?? 0) + 1));
      }
      const ranked = [...tally.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([stream]) => stream);

      setResult(ranked);
      startTransition(() => {
        submitQuizResult(nextAnswers, ranked);
      });
    } else {
      setStep(step + 1);
    }
  }

  if (result) {
    return (
      <Card className="p-8 text-center">
        <h2 className="text-lg font-semibold">Based on your answers…</h2>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {result.map((stream) => (
            <span
              key={stream}
              className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary"
            >
              {stream}
            </span>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-sm text-sm text-muted-foreground">
          This is a starting point, not a verdict — explore related content in{" "}
          <a href="/discover" className="font-medium text-primary hover:underline">
            Discover
          </a>{" "}
          to see if it clicks.
        </p>
        <Button
          className="mt-6"
          variant="outline"
          onClick={() => {
            setStep(0);
            setAnswers({});
            setResult(null);
          }}
        >
          Retake quiz
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <p className="text-xs font-medium text-muted-foreground">
        Question {step + 1} of {questions.length}
      </p>
      <h2 className="mt-2 text-lg font-semibold">{question.question}</h2>
      <div className="mt-5 space-y-2">
        {question.options.map((option) => (
          <button
            key={option.label}
            disabled={isPending}
            onClick={() => selectOption(option.label)}
            className="block w-full rounded-lg border border-border px-4 py-3 text-left text-sm hover:border-primary hover:bg-primary/5 disabled:opacity-50"
          >
            {option.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
