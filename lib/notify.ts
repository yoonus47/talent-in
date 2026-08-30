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
 */
export async function notify(
  supabase: SupabaseClient<Database>,
  params: {
    recipientId: string;
    actorId: string;
    type: NotificationType;
    postId?: string;
    reactionType?: ReactionType;
  },
) {
  if (params.recipientId === params.actorId) return;

  await supabase.from("notifications").insert({
    user_id: params.recipientId,
    actor_id: params.actorId,
    type: params.type,
    post_id: params.postId ?? null,
    reaction_type: params.reactionType ?? null,
  });
}
