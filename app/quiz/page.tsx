import { createClient } from "@/lib/supabase/server";
import { QuizFlow } from "@/components/quiz-flow";

export default async function QuizPage() {
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("*")
    .order("order", { ascending: true });

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold">Career Interest Quiz</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Five quick questions — no right answers.
      </p>

      <div className="mt-6">
        {!questions || questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Quiz questions haven&apos;t been seeded yet — run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">supabase/seed.sql</code> against
            your project.
          </p>
        ) : (
          <QuizFlow questions={questions} />
        )}
      </div>
    </div>
  );
}
