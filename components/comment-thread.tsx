"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { setCommentReaction } from "@/lib/actions/comments";
import type { FeedComment } from "@/lib/data";
import { REACTIONS } from "@/lib/reactions";
import { Avatar } from "@/components/ui/avatar";
import { ReactionRow } from "@/components/reaction-row";
import { ReactionSummary } from "@/components/reaction-summary";
import { CommentContent } from "@/components/comment-content";
import { DeleteCommentButton } from "@/components/delete-comment-button";
import { MentionInput } from "@/components/mention-input";
import { cn, timeAgo } from "@/lib/utils";

// Instagram's own convention: double-tap always *sets* the default
// reaction, it never un-reacts — so an extra double-tap on something you
// already reacted to just re-plays the burst, harmlessly.
const DOUBLE_TAP_REACTION = REACTIONS[0].type;
const DOUBLE_TAP_WINDOW_MS = 300;

function CommentRow({
  comment,
  postId,
  canReply,
}: {
  comment: FeedComment;
  postId: string;
  canReply: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [burst, setBurst] = useState(false);
  const [, startTransition] = useTransition();
  const lastTapRef = useRef(0);

  // A manual timing-based double-tap detector, not the native `dblclick`
  // event — touch-to-dblclick synthesis is inconsistent across mobile
  // browsers, whereas comparing two onClick timestamps works identically
  // for a mouse double-click and a finger double-tap.
  function handleTap() {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_WINDOW_MS;
    lastTapRef.current = isDoubleTap ? 0 : now;
    if (!isDoubleTap) return;

    if (comment.myReaction !== DOUBLE_TAP_REACTION) {
      startTransition(() => {
        setCommentReaction(comment.id, comment.author.id, DOUBLE_TAP_REACTION, comment.myReaction);
      });
    }
    setBurst(true);
    setTimeout(() => setBurst(false), 600);
  }

  return (
    <div className="text-sm">
      <div className="flex items-start gap-2">
        <Link href={`/profile/${comment.author.username}`} className="shrink-0">
          <Avatar name={comment.author.full_name} src={comment.author.avatar_url} size={28} />
        </Link>
        <div className="min-w-0 flex-1">
          <div
            onClick={handleTap}
            className="relative touch-manipulation select-none rounded-2xl bg-muted px-3 py-1.5"
          >
            <Link
              href={`/profile/${comment.author.username}`}
              className="text-xs font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {comment.author.full_name}
            </Link>
            <div className="text-foreground">
              <CommentContent content={comment.content} />
            </div>
            {burst && (
              <span
                className={cn(
                  "pointer-events-none absolute inset-0 flex items-center justify-center text-4xl",
                  "animate-[ping_0.6s_ease-out]",
                )}
              >
                {REACTIONS[0].emoji}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 pl-3 text-xs text-muted-foreground">
            <span>{timeAgo(comment.created_at)}</span>
            <ReactionSummary counts={comment.reactionCounts} size="sm" />
            <ReactionRow
              size="sm"
              counts={comment.reactionCounts}
              myReaction={comment.myReaction}
              buildAction={(type) =>
                setCommentReaction.bind(null, comment.id, comment.author.id, type, comment.myReaction)
              }
            />
            {canReply && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="font-medium hover:text-primary"
              >
                Reply
              </button>
            )}
            {comment.isOwnComment && <DeleteCommentButton commentId={comment.id} />}
          </div>

          {replying && (
            <div className="mt-2 pl-3">
              <MentionInput
                postId={postId}
                recipientId={comment.author.id}
                parentCommentId={comment.id}
                placeholder={`Reply to ${comment.author.full_name}…`}
                defaultValue={`@${comment.author.username} `}
                submitLabel="Reply"
                autoFocus
                onSubmitted={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </div>

      {comment.replies.length > 0 && (
        <div className="mt-2 space-y-2 pl-9">
          {comment.replies.map((reply) => (
            <CommentRow key={reply.id} comment={reply} postId={postId} canReply={false} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One top-level comment plus its (one level deep) replies. */
export function CommentThread({ comment, postId }: { comment: FeedComment; postId: string }) {
  return <CommentRow comment={comment} postId={postId} canReply />;
}
