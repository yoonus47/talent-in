import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationType } from "@/lib/types/database";
import type { ReactionType } from "@/lib/reactions";

/**
 * Records a notification for `recipientId`, as `actorId`. Called from
 * inside existing server actions (toggleFollow, setReaction, addComment,
 * toggleShare) using the Supabase client they already created — no extra
 * client, no separate "use server" surface.
 *
 * No-ops on self-notifications (e.g. reacting to your own post).
 *
 * Also no-ops when actor/recipient have blocked each other — most call
 * sites already can't be reached in that case (their insert is refused by
 * the matching block-aware RLS policy first, e.g. comments/reactions/
 * community_replies, see 0051_block_social_interactions.sql), but a
 * @mention notification's recipient is an arbitrary picked user unrelated
 * to the post/comment/thread ownership those policies check, so it needs
 * this check of its own — otherwise a blocked person could still get
 * pinged by name-mention alone.
 */
export async function notify(
  supabase: SupabaseClient<Database>,
  params: {
    recipientId: string;
    actorId: string;
    type: NotificationType;
    postId?: string;
    commentId?: string;
    reactionType?: ReactionType;
    communityThreadId?: string;
    communityReplyId?: string;
  },
) {
  if (params.recipientId === params.actorId) return;

  const { data: blocked } = await supabase.rpc("users_blocked_each_other", {
    a: params.actorId,
    b: params.recipientId,
  });
  if (blocked) return;

  await supabase.from("notifications").insert({
    user_id: params.recipientId,
    actor_id: params.actorId,
    type: params.type,
    post_id: params.postId ?? null,
    comment_id: params.commentId ?? null,
    reaction_type: params.reactionType ?? null,
    community_thread_id: params.communityThreadId ?? null,
    community_reply_id: params.communityReplyId ?? null,
  });
}
