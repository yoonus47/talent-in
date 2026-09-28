"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { revalidateSocialSurfaces } from "@/lib/revalidate";

/**
 * Blocks `targetUserId` — symmetric and mutual (see supabase/migrations/
 * 0048_user_blocking.sql): an AFTER INSERT trigger on `blocks` removes any
 * existing follow in either direction, and RLS on `follows`/`messages`
 * refuses new ones between the pair from here on. Same shape as
 * toggleFollow in lib/actions/profile.ts.
 */
export async function blockUser(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (targetUserId === user.id) return;

  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: user.id, blocked_id: targetUserId });
  if (error) {
    console.error("blockUser failed:", error.message);
    return;
  }

  revalidateSocialSurfaces();
}

/** Unblocks `targetUserId` — from Account Settings' Blocked accounts list. */
export async function unblockUser(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetUserId);

  revalidateSocialSurfaces();
  revalidatePath("/settings");
}
