"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts (or resumes) a conversation with `otherUserId` and redirects into
 * it. Re-checks mutual follow here as defense in depth, but the real guard
 * is the `conversations` insert RLS policy (0015_direct_messages.sql) — a
 * client can't create a DM thread without it no matter what this function
 * does.
 */
export async function startConversation(otherUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (otherUserId === user.id) return;

  const [{ data: iFollowThem }, { data: theyFollowMe }] = await Promise.all([
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", otherUserId)
      .maybeSingle(),
    supabase
      .from("follows")
      .select("follower_id")
      .eq("follower_id", otherUserId)
      .eq("following_id", user.id)
      .maybeSingle(),
  ]);
  if (!iFollowThem || !theyFollowMe) return;

  // Canonical ordering matches the `user_a_id < user_b_id` check constraint
  // — a pair only ever gets one row regardless of who starts it.
  const [userAId, userBId] = [user.id, otherUserId].sort();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a_id", userAId)
    .eq("user_b_id", userBId)
    .maybeSingle();

  if (existing) redirect(`/chat/${existing.id}`);

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({ user_a_id: userAId, user_b_id: userBId })
    .select("id")
    .single();

  if (error || !created) {
    console.error("startConversation failed:", error?.message);
    return;
  }

  redirect(`/chat/${created.id}`);
}

/**
 * Marks a conversation read as of now, for the current user only. Called
 * both directly during the thread page's render (on open) and as a client
 * Server Action call (when a realtime message arrives while the thread is
 * open) — no revalidatePath here, since /chat and /chat/[id] are already
 * fully dynamic (cookies()-based) and re-fetch fresh on every navigation;
 * calling it from a page's render is what a bare Server Action call
 * actually needs to support (revalidatePath explicitly can't run there).
 */
export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("conversation_reads")
    .upsert(
      { conversation_id: conversationId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "conversation_id,user_id" },
    );
}

/** Ownership-checked delete — "unsend" — mirrors deleteComment. */
export async function deleteMessage(messageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", user.id);
}
