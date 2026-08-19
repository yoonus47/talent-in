"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitQuizResult(
  answers: Record<string, string>,
  suggestedStreams: string[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("quiz_results")
    .insert({ user_id: user.id, answers, suggested_streams: suggestedStreams });
}
