"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { communityReplySchema, communityThreadSchema } from "@/lib/validation";
import type { ReactionType } from "@/lib/reactions";
import { notify } from "@/lib/notify";

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

/**
 * Mirrors lib/actions/comments.ts's addComment — now with the same
 * mentions/notify shape that was deferred in 0028_community.sql's first
 * pass. `recipientId` is always the thread author (community replies are
 * flat, one level, so there's no "reply to a reply" case the way comments
 * have); `mentionedUserIds` come from the reply composer's own
 * @mention-autocomplete picks (components/community-reply-composer.tsx),
 * never parsed back out of the text, same contract addComment documents.
 */
export async function createCommunityReply(
  threadId: string,
  recipientId: string,
  mentionedUserIds: string[],
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = communityReplySchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return;

  const { data: newReply, error } = await supabase
    .from("community_replies")
    .insert({
      thread_id: threadId,
      author_id: user.id,
      content: parsed.data.content,
      mentioned_user_ids: mentionedUserIds,
    })
    .select("id")
    .single();
  // reply_count/last_activity_at update via sync_community_thread_activity
  // (the trigger, 0028_community.sql) — nothing to do here for that.

  if (error || !newReply) return;

  await notify(supabase, {
    recipientId,
    actorId: user.id,
    type: "community_reply",
    communityThreadId: threadId,
    communityReplyId: newReply.id,
  });

  for (const mentionedId of mentionedUserIds) {
    await notify(supabase, {
      recipientId: mentionedId,
      actorId: user.id,
      type: "community_mention",
      communityThreadId: threadId,
      communityReplyId: newReply.id,
    });
  }

  revalidatePath(`/community/${threadId}`);
}

/** Sets (or clears) the current user's reaction on a thread — mirrors
 * setReaction (lib/actions/posts.ts) exactly, one level up from
 * setCommunityReplyReaction below. */
export async function setCommunityThreadReaction(
  threadId: string,
  threadAuthorId: string,
  type: ReactionType,
  currentType: ReactionType | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (currentType === type) {
    await supabase
      .from("community_thread_reactions")
      .delete()
      .eq("thread_id", threadId)
      .eq("user_id", user.id);
  } else {
    const { error } = currentType
      ? await supabase
          .from("community_thread_reactions")
          .update({ reaction_type: type })
          .eq("thread_id", threadId)
          .eq("user_id", user.id)
      : await supabase
          .from("community_thread_reactions")
          .insert({ thread_id: threadId, user_id: user.id, reaction_type: type });

    if (error) {
      console.error("setCommunityThreadReaction failed:", error.message);
      return;
    }

    await notify(supabase, {
      recipientId: threadAuthorId,
      actorId: user.id,
      type: "community_reaction",
      reactionType: type,
      communityThreadId: threadId,
    });
  }

  revalidatePath(`/community/${threadId}`);
  revalidatePath("/community");
}

/** Same shape, one level down — a reply's reaction. */
export async function setCommunityReplyReaction(
  replyId: string,
  threadId: string,
  replyAuthorId: string,
  type: ReactionType,
  currentType: ReactionType | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (currentType === type) {
    await supabase
      .from("community_reply_reactions")
      .delete()
      .eq("reply_id", replyId)
      .eq("user_id", user.id);
  } else {
    const { error } = currentType
      ? await supabase
          .from("community_reply_reactions")
          .update({ reaction_type: type })
          .eq("reply_id", replyId)
          .eq("user_id", user.id)
      : await supabase
          .from("community_reply_reactions")
          .insert({ reply_id: replyId, user_id: user.id, reaction_type: type });

    if (error) {
      console.error("setCommunityReplyReaction failed:", error.message);
      return;
    }

    await notify(supabase, {
      recipientId: replyAuthorId,
      actorId: user.id,
      type: "community_reaction",
      reactionType: type,
      communityThreadId: threadId,
      communityReplyId: replyId,
    });
  }

  revalidatePath(`/community/${threadId}`);
}

/** Upserts this user's "last viewed" watermark for a thread — drives the
 * unread dot on the thread list (lib/data.ts's getCommunityThreads).
 * Mirrors markConversationRead (lib/actions/chat.ts): called unconditionally
 * on every thread-page load, not just the first time. */
export async function markCommunityThreadRead(threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("community_thread_reads")
    .upsert(
      { thread_id: threadId, user_id: user.id, last_viewed_at: new Date().toISOString() },
      { onConflict: "thread_id,user_id" },
    );
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
