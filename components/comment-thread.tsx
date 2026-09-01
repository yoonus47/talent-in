"use client";

import { useState } from "react";
import Link from "next/link";
import { setCommentReaction } from "@/lib/actions/comments";
import type { FeedComment } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { ReactionRow } from "@/components/reaction-row";
import { ReactionSummary } from "@/components/reaction-summary";
import { CommentContent } from "@/components/comment-content";
import { DeleteCommentButton } from "@/components/delete-comment-button";
import { DoubleTapReact, DOUBLE_TAP_REACTION } from "@/components/double-tap-react";
import { MentionInput } from "@/components/mention-input";
import { timeAgo } from "@/lib/utils";

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

  return (
    <div className="text-sm">
      <div className="flex items-start gap-2">
        <Link href={`/profile/${comment.author.username}`} className="shrink-0">
          <Avatar name={comment.author.full_name} src={comment.author.avatar_url} size={28} />
        </Link>
        <div className="min-w-0 flex-1">
          <DoubleTapReact
            myReaction={comment.myReaction}
            reactAction={setCommentReaction.bind(
              null,
              comment.id,
              comment.author.id,
              DOUBLE_TAP_REACTION,
              comment.myReaction,
            )}
            className="rounded-2xl bg-muted px-3 py-1.5"
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
          </DoubleTapReact>
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
