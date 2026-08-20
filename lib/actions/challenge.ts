"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DailyChallengeAnswer, DailyChallengeResult } from "@/lib/types/database";

/**
 * Grades today's daily challenge server-side via the `submit_daily_challenge`
 * RPC (see supabase/migrations/0002_dashboard_and_share.sql) — the answer
 * key never reaches the client, before or after submission (the RPC only
 * returns per-question correct/incorrect, not the right answer itself).
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
