"use client";

import { useState } from "react";
import { CommentThread } from "@/components/comment-thread";
import type { FeedComment } from "@/lib/data";

const COLLAPSED_COUNT = 2;

/** The comment list under a post — collapses to the most recent couple of
 * comments with a "View all N comments" expand, instead of always
 * dumping every comment inline (a post with 30 comments was making the
 * whole feed unnecessarily long to scroll past). Purely a display
 * truncation — every comment is already loaded server-side either way,
 * so expanding is instant, no extra fetch. */
export function PostComments({ comments, postId }: { comments: FeedComment[]; postId: string }) {
  const [expanded, setExpanded] = useState(false);

  if (comments.length === 0) return null;

  const hidden = comments.length - COLLAPSED_COUNT;
  const visible = expanded || hidden <= 0 ? comments : comments.slice(-COLLAPSED_COUNT);

  return (
    <div className="space-y-3">
      {!expanded && hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          View all {comments.length} comments
        </button>
      )}
      {visible.map((comment) => (
        <CommentThread key={comment.id} comment={comment} postId={postId} />
      ))}
    </div>
  );
}
