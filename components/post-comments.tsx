import { CommentThread } from "@/components/comment-thread";
import type { FeedComment } from "@/lib/data";

/** The comment list under a post — only ever rendered while
 * components/post-card.tsx's own `open` state is true, so no visibility
 * logic lives here anymore (an earlier version collapsed to the most
 * recent couple of comments internally; now the whole section starts
 * closed instead, see PostCard's own comment). Every comment is already
 * loaded server-side, so there's nothing left to fetch here either way —
 * this is purely "lay out however many comments were handed to it." */
export function PostComments({ comments, postId }: { comments: FeedComment[]; postId: string }) {
  if (comments.length === 0) return null;

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentThread key={comment.id} comment={comment} postId={postId} />
      ))}
    </div>
  );
}
