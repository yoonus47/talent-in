"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { communityReplySchema, communityThreadSchema } from "@/lib/validation";
import type { ReactionType } from "@/lib/reactions";
import { notify } from "@/lib/notify";
import { validateImageFile, extensionFor, storagePathFromPublicUrl } from "@/lib/uploads";
import type { CommunityFlair } from "@/lib/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { FLAIR_OPTIONS } from "@/lib/community-flair";

const MAX_THREAD_IMAGE_BYTES = 5 * 1024 * 1024; // matches MAX_POST_IMAGE_BYTES (posts.ts)
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTIONS = 6;
const REPORT_REASONS = ["spam", "harassment", "inappropriate", "other"] as const;

/**
 * Uploads a thread/reply image to the shared post-images bucket and
 * returns its public URL + dimensions — shared by createCommunityThread
 * and createCommunityReply below (both attach an image to an already-
 * inserted row, after the fact, same as createPost's own "text must
 * never be lost to a photo problem" ordering; see either call site for
 * why). Returns null on any failure — every caller treats that as
 * "no image," never as a reason to fail the whole post, matching how
 * createPost's own image half already behaves.
 */
async function uploadCommunityImage(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File,
  formData: FormData,
): Promise<{ url: string; width: number | null; height: number | null } | null> {
  const validationError = validateImageFile(file, MAX_THREAD_IMAGE_BYTES);
  if (validationError) {
    console.error("community image rejected:", validationError);
    return null;
  }
  // Nested under the user's own id first (not "community/<id>/...") —
  // the post-images bucket's insert policy (0008_post_images_storage.sql)
  // only checks the *first* path segment is the caller's own uid, so
  // this still satisfies it while keeping community uploads visibly
  // separate from feed post images.
  const path = `${userId}/community/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const { error: uploadError } = await supabase.storage
    .from("post-images")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("community image upload failed:", uploadError.message);
    return null;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("post-images").getPublicUrl(path);
  const width = Number(formData.get("imageWidth"));
  const height = Number(formData.get("imageHeight"));
  return {
    url: publicUrl,
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
  };
}

/**
 * Starts a new thread under `topicId` and redirects into it — mirrors
 * lib/actions/posts.ts's createPost's shape (parse, insert as self,
 * revalidate; image upload happens *after* the row exists, same "text
 * must never be lost to a photo problem" ordering createPost uses).
 * RLS (0028_community.sql's "users can start threads as themselves") is
 * the real ownership guard; author_id is still set here explicitly so the
 * insert can't silently succeed as someone else if that check ever
 * changes.
 *
 * Also handles: anonymous posting (is_anonymous — hides the author in the
 * UI only, see 0031_community_round3.sql's own comment), an optional
 * poll (2-6 "option" fields in formData), and auto-following your own
 * thread (community_thread_follows) — the mechanism createCommunityReply
 * below uses to notify "everyone invested in this thread," author
 * included, with no special-casing needed for the author specifically.
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

  const isAnonymous = formData.get("isAnonymous") === "on";
  const flairRaw = formData.get("flair");
  const flair = FLAIR_OPTIONS.includes(flairRaw as CommunityFlair) ? (flairRaw as CommunityFlair) : null;

  const { data: thread, error } = await supabase
    .from("community_threads")
    .insert({
      topic_id: topicId,
      author_id: user.id,
      title: parsed.data.title,
      body: parsed.data.body,
      is_anonymous: isAnonymous,
      flair,
    })
    .select("id")
    .single();

  if (error || !thread) {
    return { error: error?.message ?? "Could not start the thread." };
  }

  // Image — best-effort, same as createPost: a failure here never costs
  // the user the thread they just wrote.
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadCommunityImage(supabase, user.id, file, formData);
    if (uploaded) {
      // community_threads has no general update policy (0028) — this
      // relies on the same narrow "author_id = auth.uid()" carve-out
      // 0031 adds specifically for image_url/image_width/image_height
      // (see that migration's own comment on why this one column set
      // gets a real policy instead of an RPC: unlike best_reply_id/
      // is_pinned, there's no *other* client-writable column on this
      // row it could be abused to also touch).
      const { error: updateError } = await supabase
        .from("community_threads")
        .update({ image_url: uploaded.url, image_width: uploaded.width, image_height: uploaded.height })
        .eq("id", thread.id);
      if (updateError) console.error("thread image link failed:", updateError.message);
    }
  }

  // Poll — 2 to 6 non-empty option labels, in the order submitted.
  const optionLabels = formData
    .getAll("pollOption")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0)
    .slice(0, MAX_POLL_OPTIONS);
  if (optionLabels.length >= MIN_POLL_OPTIONS) {
    const { error: pollError } = await supabase.from("community_poll_options").insert(
      optionLabels.map((label, position) => ({ thread_id: thread.id, label, position })),
    );
    if (pollError) console.error("poll option insert failed:", pollError.message);
  }

  const { error: followError } = await supabase
    .from("community_thread_follows")
    .insert({ thread_id: thread.id, user_id: user.id });
  if (followError) console.error("auto-follow own thread failed:", followError.message);

  revalidatePath("/community");
  redirect(`/community/${thread.id}`);
}

/**
 * Mirrors lib/actions/comments.ts's addComment's mention-notify shape,
 * but the "who gets told about this" list is every current follower of
 * the thread (community_thread_follows), not a single passed-in
 * recipient — the thread author is one by construction (auto-followed at
 * creation, above), so this one loop covers "notify the author" and
 * "notify whoever else replied before you" identically, no special
 * casing either way. `notify()` already no-ops a self-notification, so
 * the replier showing up in their own follower list costs nothing.
 *
 * Also upserts a follow row for the replier themselves — replying
 * implies wanting to know what happens next, same as GitHub auto-
 * subscribing you to an issue the moment you comment on it.
 *
 * `parentReplyId`, when set, nests this one level under an existing
 * top-level reply — mirrors comments.parent_comment_id's own "one level,
 * enforced by the app not the DB" posture (0010_comment_threads_and_
 * reactions.sql). If the given parent already has a parent of its own,
 * this silently reparents to null instead of failing the whole submit —
 * same "don't lose the user's text over a malformed aside" philosophy
 * the image-upload half already uses, just applied to a different field.
 */
export async function createCommunityReply(
  threadId: string,
  mentionedUserIds: string[],
  parentReplyId: string | null,
  formData: FormData,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = communityReplySchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return;

  let resolvedParentId: string | null = null;
  if (parentReplyId) {
    const { data: parent } = await supabase
      .from("community_replies")
      .select("id, parent_reply_id")
      .eq("id", parentReplyId)
      .eq("thread_id", threadId)
      .maybeSingle();
    if (parent && !parent.parent_reply_id) resolvedParentId = parent.id;
  }

  const { data: newReply, error } = await supabase
    .from("community_replies")
    .insert({
      thread_id: threadId,
      author_id: user.id,
      content: parsed.data.content,
      mentioned_user_ids: mentionedUserIds,
      parent_reply_id: resolvedParentId,
    })
    .select("id")
    .single();
  // reply_count/last_activity_at update via sync_community_thread_activity
  // (the trigger, 0028_community.sql) — nothing to do here for that.

  if (error || !newReply) return;

  // Image — best-effort, same ordering as the thread's own (see
  // uploadCommunityImage's own comment).
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadCommunityImage(supabase, user.id, file, formData);
    if (uploaded) {
      const { error: updateError } = await supabase
        .from("community_replies")
        .update({ image_url: uploaded.url, image_width: uploaded.width, image_height: uploaded.height })
        .eq("id", newReply.id);
      if (updateError) console.error("reply image link failed:", updateError.message);
    }
  }

  const { data: followers } = await supabase
    .from("community_thread_follows")
    .select("user_id")
    .eq("thread_id", threadId);

  for (const follower of followers ?? []) {
    await notify(supabase, {
      recipientId: follower.user_id,
      actorId: user.id,
      type: "community_reply",
      communityThreadId: threadId,
      communityReplyId: newReply.id,
    });
  }

  for (const mentionedId of mentionedUserIds) {
    await notify(supabase, {
      recipientId: mentionedId,
      actorId: user.id,
      type: "community_mention",
      communityThreadId: threadId,
      communityReplyId: newReply.id,
    });
  }

  const { error: followError } = await supabase
    .from("community_thread_follows")
    .upsert({ thread_id: threadId, user_id: user.id }, { onConflict: "thread_id,user_id" });
  if (followError) console.error("auto-follow on reply failed:", followError.message);

  revalidatePath(`/community/${threadId}`);
}

/** Explicit follow/unfollow toggle — mirrors toggleShare's
 * insert/delete-by-presence pattern (lib/actions/posts.ts). Reply already
 * auto-follows (see above); this is for someone who just wants to watch a
 * thread without posting in it, or who wants to opt back out. */
export async function toggleCommunityThreadFollow(threadId: string, isFollowing: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isFollowing) {
    await supabase
      .from("community_thread_follows")
      .delete()
      .eq("thread_id", threadId)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("community_thread_follows")
      .insert({ thread_id: threadId, user_id: user.id });
  }

  revalidatePath(`/community/${threadId}`);
}

/** Explicit save/unsave — a purely personal "revisit later" marker,
 * distinct from Follow above (no notifications implied, nobody else ever
 * reads it — community_thread_saves' RLS is self-only, unlike follows'
 * open-select, since nothing here needs a notify-style loop over other
 * users' rows). Same insert/delete-by-presence shape as follow/toggleShare. */
export async function toggleCommunityThreadSave(threadId: string, isSaved: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isSaved) {
    await supabase
      .from("community_thread_saves")
      .delete()
      .eq("thread_id", threadId)
      .eq("user_id", user.id);
  } else {
    await supabase.from("community_thread_saves").insert({ thread_id: threadId, user_id: user.id });
  }

  revalidatePath(`/community/${threadId}`);
  revalidatePath("/community");
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

/** Marks (or clears, pass null) which reply is the thread's "best
 * answer" — a thin wrapper over the set_community_best_reply RPC
 * (0031_community_round3.sql), which does the real author-only check
 * server-side (SECURITY DEFINER, since community_threads has no general
 * update policy to piggyback on — see that migration's comment). Points
 * (+10/-10) and the community_best_answer notification are both handled
 * by a trigger on the RPC's own update, not here. */
export async function setCommunityBestReply(threadId: string, replyId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("set_community_best_reply", {
    p_thread_id: threadId,
    p_reply_id: replyId,
  });
  if (error) console.error("setCommunityBestReply failed:", error.message);

  revalidatePath(`/community/${threadId}`);
}

/** Pin/unpin — author-only (same RPC-not-policy reasoning as above). No
 * moderator role exists in this app; pinning is deliberately scoped to
 * "the thread author curates their own thread," not a site-wide power. */
export async function setCommunityThreadPinned(threadId: string, pinned: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("set_community_thread_pinned", {
    p_thread_id: threadId,
    p_pinned: pinned,
  });
  if (error) console.error("setCommunityThreadPinned failed:", error.message);

  revalidatePath(`/community/${threadId}`);
  revalidatePath("/community");
}

/** Casts (or changes) the current user's vote in a thread's poll — a
 * plain upsert against community_poll_votes' (thread_id, user_id)
 * primary key, so re-voting just changes option_id on the same row. */
export async function voteCommunityPoll(threadId: string, optionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("community_poll_votes")
    .upsert(
      { thread_id: threadId, user_id: user.id, option_id: optionId },
      { onConflict: "thread_id,user_id" },
    );
  if (error) console.error("voteCommunityPoll failed:", error.message);

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

/** Ownership-checked delete — mirrors deletePost/deleteComment, including
 * deletePost's storage cleanup (lib/actions/posts.ts) for any attached
 * image, so a deleted thread doesn't leave an orphaned file behind in the
 * shared post-images bucket. Cascades to the thread's replies/reactions/
 * follows/poll rows via their FKs (on delete cascade). */
export async function deleteCommunityThread(threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: thread } = await supabase
    .from("community_threads")
    .select("image_url")
    .eq("id", threadId)
    .eq("author_id", user.id)
    .maybeSingle();

  await supabase.from("community_threads").delete().eq("id", threadId).eq("author_id", user.id);

  if (thread?.image_url) {
    const path = storagePathFromPublicUrl(thread.image_url, "post-images");
    if (path) await supabase.storage.from("post-images").remove([path]);
  }

  revalidatePath("/community");
  redirect("/community");
}

/** Ownership-checked delete — mirrors deleteComment, plus the same
 * storage cleanup deleteCommunityThread does for its own image. Cascades
 * to any nested replies underneath this one (parent_reply_id references
 * ... on delete cascade) — same "hard delete, no placeholder" convention
 * deleteComment already uses one level up. */
export async function deleteCommunityReply(replyId: string, threadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: reply } = await supabase
    .from("community_replies")
    .select("image_url")
    .eq("id", replyId)
    .eq("author_id", user.id)
    .maybeSingle();

  await supabase.from("community_replies").delete().eq("id", replyId).eq("author_id", user.id);

  if (reply?.image_url) {
    const path = storagePathFromPublicUrl(reply.image_url, "post-images");
    if (path) await supabase.storage.from("post-images").remove([path]);
  }

  revalidatePath(`/community/${threadId}`);
}

/**
 * Reports a thread or reply — inserts into community_reports
 * (0033_community_round4.sql), which has no select policy at all: this
 * is a deliberate v1 scope cut, captured now and reviewable via the
 * Supabase SQL editor, with no in-app moderation queue yet (no moderator
 * role exists in this app — see setCommunityThreadPinned's own comment
 * on that same decision). `targetType` picks which of thread_id/reply_id
 * gets set; the table's own check constraint requires exactly one.
 */
export async function reportCommunity(
  targetType: "thread" | "reply",
  targetId: string,
  reason: (typeof REPORT_REASONS)[number],
  details?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!REPORT_REASONS.includes(reason)) return { error: "Invalid reason" };

  const { error } = await supabase.from("community_reports").insert({
    reporter_id: user.id,
    thread_id: targetType === "thread" ? targetId : null,
    reply_id: targetType === "reply" ? targetId : null,
    reason,
    details: details?.trim() || null,
  });

  if (error) {
    console.error("reportCommunity failed:", error.message);
    return { error: "Could not submit the report." };
  }
  return { success: true };
}
