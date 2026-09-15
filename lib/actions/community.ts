"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { communityReplySchema, communityThreadSchema } from "@/lib/validation";

/**
 * Starts a new thread under `topicId` and redirects into it — mirrors
 * lib/actions/posts.ts's createPost's shape (parse, insert as self,
 * revalidate), minus the image-upload half (no images in community v1).
 * RLS (0028_community.sql's "users can start threads as themselves") is
 * the real ownership guard; author_id is still set here explicitly so the
 * insert can't silently succeed as someone else if that check ever
 * changes.
 */
export async function createCommunityThread(topicId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = communityThreadSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data: thread, error } = await supabase
    .from("community_threads")
    .insert({
      topic_id: topicId,
      author_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error || !thread) {
    return { error: error?.message ?? "Could not start the thread." };
  }

  revalidatePath("/community");
  redirect(`/community/${thread.id}`);
}

/** Mirrors lib/actions/comments.ts's addComment, minus mentions/notify —
 * see 0028_community.sql's header comment for why replies don't notify
 * yet (v1 cut, not an oversight). */
export async function createCommunityReply(threadId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = communityReplySchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return;

  await supabase
    .from("community_replies")
    .insert({ thread_id: threadId, author_id: user.id, content: parsed.data.content });
  // reply_count/last_activity_at update via sync_community_thread_activity
  // (the trigger, 0028_community.sql) — nothing to do here for that.

  revalidatePath(`/community/${threadId}`);
}

/** Ownership-checked delete — mirrors deletePost/deleteComment. Cascades
 * to the thread's replies via the FK (on delete cascade). */
export async function deleteCommunityThread(threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("community_threads").delete().eq("id", threadId).eq("author_id", user.id);
  revalidatePath("/community");
  redirect("/community");
}

/** Ownership-checked delete — mirrors deleteComment. */
export async function deleteCommunityReply(replyId: string, threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("community_replies").delete().eq("id", replyId).eq("author_id", user.id);
  revalidatePath(`/community/${threadId}`);
}
