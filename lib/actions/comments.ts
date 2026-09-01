"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { commentSchema } from "@/lib/validation";
import type { ReactionType } from "@/lib/reactions";
import { notify } from "@/lib/notify";
import { revalidatePostSurfaces } from "@/lib/revalidate";

/**
 * Adds a comment or a reply, one level deep — `parentCommentId` is null for
 * a top-level comment on the post, or a comment id to reply to it. Never
 * deeper than that (replies can't be replied to), matching LinkedIn.
 *
 * `recipientId` is who gets the primary notification: the post's author for
 * a top-level comment, or the parent comment's author for a reply — the
 * caller already has whichever is relevant on hand when it renders the
 * comment/reply form, so it's simplest to just pass the right one in rather
 * than have this function re-derive it with an extra query.
 *
 * `mentionedUserIds` come from the mention autocomplete's actual selections
 * (see components/mention-input.tsx) — not parsed back out of the text —
 * so a "mention" notification only ever goes to someone genuinely picked
 * from the list, not to every username-shaped substring.
 */
export async function addComment(
  postId: string,
  recipientId: string,
  parentCommentId: string | null,
  mentionedUserIds: string[],
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = commentSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return;

  const { data: newComment, error } = await supabase
    .from("comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      content: parsed.data.content,
      parent_comment_id: parentCommentId,
      mentioned_user_ids: mentionedUserIds,
    })
    .select("id")
    .single();

  if (error || !newComment) return;

  await notify(supabase, {
    recipientId,
    actorId: user.id,
    type: parentCommentId ? "reply" : "comment",
    postId,
    commentId: newComment.id,
  });

  for (const mentionedId of mentionedUserIds) {
    await notify(supabase, {
      recipientId: mentionedId,
      actorId: user.id,
      type: "mention",
      postId,
      commentId: newComment.id,
    });
  }

  revalidatePostSurfaces();
}

/** Same ownership check as deletePost — replies cascade via the FK. */
export async function deleteComment(commentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("comments").delete().eq("id", commentId).eq("user_id", user.id);

  revalidatePostSurfaces();
}

/**
 * Sets (or clears) the current user's reaction on a comment — identical
 * toggle/switch logic to setReaction in lib/actions/posts.ts, one level
 * down.
 */
export async function setCommentReaction(
  commentId: string,
  commentAuthorId: string,
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
      .from("comment_reactions")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", user.id);
  } else {
    if (currentType) {
      await supabase
        .from("comment_reactions")
        .update({ reaction_type: type })
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("comment_reactions")
        .insert({ comment_id: commentId, user_id: user.id, reaction_type: type });
    }
    await notify(supabase, {
      recipientId: commentAuthorId,
      actorId: user.id,
      type: "comment_reaction",
      commentId,
      reactionType: type,
    });
  }

  revalidatePostSurfaces();
}

/** Mention autocomplete — anyone on the platform, not just people followed. */
export async function searchMentionCandidates(query: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || query.trim().length === 0) return [];

  const escaped = query.trim().replace(/[%,]/g, "");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .neq("id", user.id)
    .or(`full_name.ilike.%${escaped}%,username.ilike.%${escaped}%`)
    .order("username", { ascending: true })
    .limit(6);

  if (error) {
    console.error("searchMentionCandidates failed:", error.message);
    return [];
  }

  return data ?? [];
}
