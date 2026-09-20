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
            className="rounded-2xl bg-muted px-3 py-1.5 transition-colors hover:bg-muted/80"
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
          {/* flex-wrap: on a narrow phone this row (timestamp + summary +
              the reaction pill + Reply/Delete) can be too tight to fit on
              one line — wrapping the whole row lets Reply/Delete drop to
              their own second line cleanly, instead of ReactionRow's own
              pill (which never wraps internally, see its own comment)
              getting squeezed and overflowing. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-3 text-xs text-muted-foreground">
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
        // The left border is a thread line connecting a reply run back up
        // to its parent's avatar — left-[13px] centers it under that
        // avatar (28px wide, so its middle sits at 14px), the same trick
        // components/message-bubble.tsx's avatar column uses to keep
        // multi-message runs left-aligned.
        <div className="relative mt-2 space-y-2 pl-9">
          <div className="absolute bottom-2 left-[13px] top-0 w-px bg-border" aria-hidden />
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
