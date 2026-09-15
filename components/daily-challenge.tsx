"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { submitDailyChallenge } from "@/lib/actions/challenge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChallengeAttempt, DailyChallengeQuestion, DailyChallengeResult } from "@/lib/types/database";

const SUBJECT_BADGE: Record<string, "default" | "accent" | "outline"> = {
  math: "outline",
  science: "accent",
  vocabulary: "default",
};

/** Animated 0 → score count-up for the results header — a JS tween, not
 * CSS, since the number itself (not just its opacity/position) is what's
 * changing. Runs once on mount; ignored entirely if score is 0. */
function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      // Ease-out: fast start, gentle settle — matches this app's other
      // hand-rolled easing curves (cubic-bezier(0.16, 1, 0.3, 1) family)
      // closely enough without pulling in a whole tweening library for
      // one number.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function ScoreHeader({ score, total }: { score: number; total: number }) {
  const displayed = useCountUp(score);
  const encouragement =
    score === total
      ? "Perfect round! 🎉"
      : score >= total / 2
        ? "Solid! Check the ones you missed below."
        : "Every round teaches you something — recap's below.";

  return (
    <div className="flex flex-col items-center py-2 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-7 w-7" />
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums">
        {displayed}
        <span className="text-lg font-medium text-muted-foreground"> / {total}</span>
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{encouragement}</p>
    </div>
  );
}

function RecapItem({
  question,
  graded,
  selectedIndex,
  index,
}: {
  question: DailyChallengeQuestion;
  graded: DailyChallengeResult["results"][number] | undefined;
  selectedIndex: number | undefined;
  index: number;
}) {
  if (!graded) return null;
  const wasCorrect = graded.correct;

  return (
    <div
      className="animate-wotd-reveal border-t border-border pt-3 first:border-t-0 first:pt-0"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="flex items-start gap-2">
        {wasCorrect ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        ) : (
          <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        )}
        <div className="min-w-0 flex-1">
          <Badge variant={SUBJECT_BADGE[question.subject] ?? "default"} className="capitalize">
            {question.subject}
          </Badge>
          <p className="mt-1.5 text-sm font-medium text-foreground">{question.question}</p>

          <div className="mt-2 space-y-1 text-sm">
            {!wasCorrect && selectedIndex !== undefined && (
              <p className="text-destructive line-through decoration-destructive/60">
                {question.options[selectedIndex]}
              </p>
            )}
            <p className="font-medium text-primary">{question.options[graded.correct_index]}</p>
          </div>

          {graded.explanation && (
            <p className="mt-1.5 text-xs text-muted-foreground">{graded.explanation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DailyChallenge({
  questions,
  todayAttempt,
}: {
  questions: DailyChallengeQuestion[];
  /**
   * Whether today's attempt already existed at the last server render —
   * owned here (not by the parent conditionally rendering this component
   * at all) specifically because submitDailyChallenge's own
   * revalidatePath("/dashboard") refreshes the dashboard's server data
   * right after a submit resolves. If the parent decided "show the
   * completed card vs show <DailyChallenge>" the OLD way, that refresh
   * would swap this component out for the plain completed-summary card
   * within a second or two of finishing — discarding `result` and the
   * whole recap/explanations view before most people would ever actually
   * read it (confirmed live: the recap was reachable for barely a
   * moment). Taking todayAttempt as a prop and only trusting it when this
   * component's own in-memory `result` is still null sidesteps that: a
   * fresh local result always wins over a prop update from underneath.
   */
  todayAttempt: ChallengeAttempt | null;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [pulsingIndex, setPulsingIndex] = useState<number | null>(null);
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<DailyChallengeResult | null>(null);
  const pendingRef = useRef(false);

  const question = questions[step];
  const isLast = step === questions.length - 1;

  function handlePick(index: number) {
    // pendingRef (not just pulsingIndex !== null) guards against a second
    // tap landing mid-advance, after the brief pulse delay below has
    // already started the async submit but before React's next render —
    // a plain state check alone has a tiny window where both can be true.
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPulsingIndex(index);

    // A short, deliberate delay before actually advancing — long enough
    // to see the tapped option pulse (confirms the tap registered), short
    // enough not to feel laggy. Real correctness can't be shown yet (see
    // this file's header context — grading only happens after all 5 are
    // in), so this is the only feedback available at pick-time.
    setTimeout(() => {
      const nextAnswers = { ...answers, [question.id]: index };
      setAnswers(nextAnswers);
      setPulsingIndex(null);
      pendingRef.current = false;

      if (!isLast) {
        setStep((s) => s + 1);
        return;
      }

      setGrading(true);
      const payload = Object.entries(nextAnswers).map(([question_id, selected_index]) => ({
        question_id,
        selected_index,
      }));
      submitDailyChallenge(payload).then((res) => {
        setGrading(false);
        setResult(res);
      });
    }, 260);
  }

  if (grading) {
    return (
      <Card className="flex flex-col items-center gap-2 p-8 text-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-primary/20" />
        <p className="text-sm text-muted-foreground">Grading…</p>
      </Card>
    );
  }

  // Already completed today BEFORE this component ever mounted (a real
  // prior visit, not this session's own submit — see the `todayAttempt`
  // prop's comment for why `!result` guards this). No recap/explanations
  // available here — those only exist for an attempt graded in THIS
  // session (submit_daily_challenge's per-question detail was never
  // fetched/stored for a previous day's attempt).
  if (!result && todayAttempt) {
    return (
      <Card className="p-6 text-center">
        <p className="text-2xl">✅</p>
        <p className="mt-2 font-semibold">
          Completed today: {todayAttempt.score}/{todayAttempt.total}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Come back tomorrow for a new one.</p>
      </Card>
    );
  }

  if (result) {
    return (
      <Card className="p-6">
        <ScoreHeader score={result.score} total={result.total} />
        <div className="mt-2 space-y-3">
          {questions.map((q, i) => (
            <RecapItem
              key={q.id}
              index={i}
              question={q}
              selectedIndex={answers[q.id]}
              graded={result.results.find((r) => r.question_id === q.id)}
            />
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Come back tomorrow for a new challenge.
        </p>
      </Card>
    );
  }

  if (!question) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No challenge questions yet. Run{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">supabase/seed.sql</code> against your
        project.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-6">
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${(step / questions.length) * 100}%` }}
        />
      </div>

      {/* key={question.id} forces a remount on every step, which re-plays
       * the CSS entrance animation — same trick swipe-navigator.tsx's
       * AnimatedPage uses (see its own comment on why a key is required,
       * not optional, for this to actually reset each time). */}
      <div key={question.id} className="animate-challenge-step-in mt-4">
        <div className="flex items-center justify-between">
          <Badge variant={SUBJECT_BADGE[question.subject] ?? "default"} className="capitalize">
            {question.subject}
          </Badge>
          <p className="text-xs text-muted-foreground">
            Question {step + 1} of {questions.length}
          </p>
        </div>
        <h2 className="mt-3 text-base font-semibold">{question.question}</h2>
        <div className="mt-4 space-y-2">
          {question.options.map((option, index) => (
            <button
              key={option}
              onClick={() => handlePick(index)}
              disabled={pulsingIndex !== null}
              className={cn(
                "block w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default",
                pulsingIndex === index
                  ? "animate-challenge-option-pulse border-primary bg-primary/10"
                  : "border-border hover:border-primary hover:bg-primary/5",
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
