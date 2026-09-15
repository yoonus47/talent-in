"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DailyChallengeAnswer, DailyChallengeResult } from "@/lib/types/database";

/**
 * Grades today's daily challenge server-side via the `submit_daily_challenge`
 * RPC (see supabase/migrations/0002_dashboard_and_share.sql, extended by
 * 0027_challenge_explanations.sql) — the answer key never reaches the
 * client *before* submission (get_daily_challenge, used to fetch the
 * questions, never includes it). Once grading has actually happened here,
 * each result also carries the correct option's index and a short
 * explanation, for the results recap in components/daily-challenge.tsx.
 */
export async function submitDailyChallenge(
  answers: DailyChallengeAnswer[],
): Promise<DailyChallengeResult | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("submit_daily_challenge", {
    p_answers: answers,
  });

  if (error) {
    console.error("submit_daily_challenge failed:", error.message);
    return null;
  }

  revalidatePath("/dashboard");
  return data;
}
