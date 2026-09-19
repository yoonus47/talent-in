"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Award, Trophy } from "lucide-react";
import { setCommunityBestReply, setCommunityReplyReaction } from "@/lib/actions/community";
import { DeleteCommunityReplyButton } from "@/components/delete-community-reply-button";
import { DoubleTapReact, DOUBLE_TAP_REACTION } from "@/components/double-tap-react";
import { CommunityReplyComposer } from "@/components/community-reply-composer";
import { ReactionRow } from "@/components/reaction-row";
import { ReactionSummary } from "@/components/reaction-summary";
import { ReportButton } from "@/components/report-button";
import { Avatar } from "@/components/ui/avatar";
import type { CommunityReplyItem } from "@/lib/data";
import { cn, postImageCssAspectRatio, timeAgo } from "@/lib/utils";

/**
 * One reply — top-level (`depth={0}`) or its one level of nesting
 * (`depth={1}`, rendered from a top-level reply's own `reply.replies`).
 * Only a top-level reply gets its own Reply action (`canReply`, below) —
 * one level only, matching this codebase's existing precedent for feed
 * comments (components/comment-thread.tsx's CommentRow / comments.
 * parent_comment_id) over Reddit's own unbounded nesting. Replying to a
 * nested reply still works, just as a new sibling reply with an @mention
 * pre-filled (components/community-reply-composer.tsx) rather than a
 * second indent level — the user's own framing when this was scoped:
 * "allow mentions, so it's as if they could continue to reply."
 */
export function CommunityReplyRow({
  reply,
  threadId,
  viewerId,
  isOwnThread,
  bestReplyId,
  depth,
}: {
  reply: CommunityReplyItem;
  threadId: string;
  viewerId: string;
  isOwnThread: boolean;
  bestReplyId: string | null;
  depth: 0 | 1;
}) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const isBest = reply.id === bestReplyId;
  const isOwnReply = reply.author.id === viewerId;
  const canReply = depth === 0;

  return (
    <div className={cn("text-sm", depth === 1 && "relative mt-2 pl-9")}>
      {depth === 1 && (
        // Same thread-connector-line trick components/comment-thread.tsx
        // already uses for feed-comment replies — left-[13px] centers it
        // under a 28px avatar (14px middle).
        <div className="absolute bottom-2 left-[13px] top-0 w-px bg-border" aria-hidden />
      )}
      <div className="flex items-start gap-2">
        <Link href={`/profile/${reply.author.username}`} className="shrink-0">
          <Avatar name={reply.author.full_name} src={reply.author.avatar_url} size={28} />
        </Link>
        <div className="min-w-0 flex-1">
          {isBest && (
            <p className="mb-1 flex items-center gap-1 pl-3 text-xs font-medium text-primary">
              <Award className="h-3.5 w-3.5" />
              Best answer
            </p>
          )}
          <DoubleTapReact
            myReaction={reply.myReaction}
            reactAction={setCommunityReplyReaction.bind(
              null,
              reply.id,
              threadId,
              reply.author.id,
              DOUBLE_TAP_REACTION,
              reply.myReaction,
            )}
            className={cn(
              "rounded-2xl px-3 py-2 transition-colors",
              isBest ? "border border-primary/40 bg-primary/5 hover:bg-primary/10" : "bg-muted hover:bg-muted/80",
            )}
          >
            {/* No onClick stopPropagation — this is a Client Component
                (unlike app/community/[id]/page.tsx, which had to skip it
                — see that file's own comment for why), so it could
                afford one, but it's genuinely unnecessary here: a single
                click just starts DoubleTapReact's own tap timer
                alongside the Link's normal navigation, never blocking it. */}
            <span className="inline-flex items-center gap-1.5">
              <Link
                href={`/profile/${reply.author.username}`}
                className="text-xs font-semibold text-foreground hover:underline"
              >
                {reply.author.full_name}
              </Link>
              {reply.author.community_points > 0 && (
                <span
                  title={`${reply.author.community_points} community points`}
                  className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  <Trophy className="h-2.5 w-2.5" />
                  {reply.author.community_points}
                </span>
              )}
            </span>
            <p className="mt-0.5 whitespace-pre-wrap text-foreground">{reply.content}</p>
            {reply.image_url && (
              <div
                className="relative mt-2 max-h-64 w-full max-w-xs overflow-hidden rounded-lg border border-border"
                style={{ aspectRatio: postImageCssAspectRatio({ imageWidth: reply.image_width, imageHeight: reply.image_height }) }}
              >
                <Image src={reply.image_url} alt="" fill sizes="320px" quality={60} className="object-cover" />
              </div>
            )}
          </DoubleTapReact>
          <div className="mt-0.5 flex flex-wrap items-center gap-3 pl-3 text-xs text-muted-foreground">
            <span>{timeAgo(reply.created_at)}</span>
            <ReactionSummary counts={reply.reactionCounts} size="sm" />
            <ReactionRow
              size="sm"
              counts={reply.reactionCounts}
              myReaction={reply.myReaction}
              buildAction={(type) =>
                setCommunityReplyReaction.bind(null, reply.id, threadId, reply.author.id, type, reply.myReaction)
              }
            />
            {canReply && (
              <button
                type="button"
                onClick={() => setShowReplyBox((v) => !v)}
                className="font-medium hover:text-primary"
              >
                Reply
              </button>
            )}
            {/* Only the thread's own author can mark a best answer —
                matches pinning's "curate your own thread" scope, enforced
                server-side too (set_community_best_reply RPC). */}
            {isOwnThread && (
              <form
                action={setCommunityBestReply.bind(null, threadId, isBest ? null : reply.id)}
                className="ml-auto"
              >
                <button
                  type="submit"
                  title={isBest ? "Unmark as best answer" : "Mark as best answer"}
                  className={cn("flex items-center hover:text-primary", isBest && "text-primary")}
                >
                  <Award className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
            {!isOwnReply && (
              <ReportButton targetType="reply" targetId={reply.id} className={isOwnThread ? "" : "ml-auto"} />
            )}
            {isOwnReply && (
              <DeleteCommunityReplyButton
                replyId={reply.id}
                threadId={threadId}
                className={isOwnThread ? "" : "ml-auto"}
              />
            )}
          </div>

          {canReply && showReplyBox && (
            <div className="mt-2 pl-3">
              <CommunityReplyComposer
                threadId={threadId}
                parentReply={{ id: reply.id, username: reply.author.username }}
                autoFocus
                onSubmitted={() => setShowReplyBox(false)}
              />
            </div>
          )}

          {reply.replies.length > 0 && (
            <div className="space-y-2">
              {reply.replies.map((child) => (
                <CommunityReplyRow
                  key={child.id}
                  reply={child}
                  threadId={threadId}
                  viewerId={viewerId}
                  isOwnThread={isOwnThread}
                  bestReplyId={bestReplyId}
                  depth={1}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
