import Link from "next/link";
import { MessageCircle, Repeat2 } from "lucide-react";
import type { FeedPost } from "@/lib/data";
import { setReaction, toggleShare } from "@/lib/actions/posts";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { DeletePostButton } from "@/components/delete-post-button";
import { ReactionRow } from "@/components/reaction-row";
import { ReactionSummary } from "@/components/reaction-summary";
import { DoubleTapReact, DOUBLE_TAP_REACTION } from "@/components/double-tap-react";
import { PostImage } from "@/components/post-image";
import { CommentThread } from "@/components/comment-thread";
import { MentionInput } from "@/components/mention-input";
import { timeAgo } from "@/lib/utils";

function countAllComments(post: FeedPost): number {
  return post.comments.reduce((total, c) => total + 1 + c.replies.length, 0);
}

export function PostCard({ post }: { post: FeedPost }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${post.author.username}`}>
          <Avatar name={post.author.full_name} src={post.author.avatar_url} size={40} />
        </Link>
        <div className="flex-1">
          <Link
            href={`/profile/${post.author.username}`}
            className="text-sm font-semibold hover:underline"
          >
            {post.author.full_name}
          </Link>
          <p className="text-xs text-muted-foreground">
            @{post.author.username} · {timeAgo(post.created_at)}
          </p>
        </div>
        {post.isOwnPost && <DeletePostButton postId={post.id} />}
      </div>

      <DoubleTapReact
        className="mt-3"
        myReaction={post.myReaction}
        reactAction={setReaction.bind(
          null,
          post.id,
          post.author.id,
          DOUBLE_TAP_REACTION,
          post.myReaction,
        )}
      >
        <p className="whitespace-pre-wrap text-sm text-foreground">{post.content}</p>
      </DoubleTapReact>

      {/* The image gets its own tap handling (single tap opens the
          lightbox, double tap reacts) — separate from the text's
          DoubleTapReact above, which only ever reacts. */}
      <PostImage post={post} />

      <div className="mt-3">
        <ReactionSummary counts={post.reactionCounts} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        <ReactionRow
          counts={post.reactionCounts}
          myReaction={post.myReaction}
          buildAction={(type) =>
            setReaction.bind(null, post.id, post.author.id, type, post.myReaction)
          }
        />

        <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          {countAllComments(post)}
        </span>
        <form action={toggleShare.bind(null, post.id, post.author.id, post.sharedByMe)}>
          <button
            type="submit"
            className="flex items-center gap-1.5 pl-3 text-sm text-muted-foreground hover:text-primary"
          >
            <Repeat2
              className="h-4 w-4"
              color={post.sharedByMe ? "var(--primary)" : "currentColor"}
            />
            {post.shareCount}
          </button>
        </form>
      </div>

      {post.comments.length > 0 && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {post.comments.map((comment) => (
            <CommentThread key={comment.id} comment={comment} postId={post.id} />
          ))}
        </div>
      )}

      <div className="mt-3">
        <MentionInput
          postId={post.id}
          recipientId={post.author.id}
          parentCommentId={null}
          placeholder="Add a comment…"
        />
      </div>
    </Card>
  );
}
