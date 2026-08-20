import Link from "next/link";
import { Heart, MessageCircle, Repeat2 } from "lucide-react";
import type { FeedPost } from "@/lib/data";
import { addComment, toggleLike, toggleShare } from "@/lib/actions/posts";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { timeAgo } from "@/lib/utils";

export function PostCard({ post }: { post: FeedPost }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${post.author.username}`}>
          <Avatar name={post.author.full_name} src={post.author.avatar_url} size={40} />
        </Link>
        <div>
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
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{post.content}</p>

      <div className="mt-3 flex items-center gap-4 border-t border-border pt-3">
        <form action={toggleLike.bind(null, post.id, post.likedByMe)}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
          >
            <Heart
              className="h-4 w-4"
              fill={post.likedByMe ? "currentColor" : "none"}
              color={post.likedByMe ? "var(--primary)" : "currentColor"}
            />
            {post.likeCount}
          </button>
        </form>
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          {post.comments.length}
        </span>
        <form action={toggleShare.bind(null, post.id, post.sharedByMe)}>
          <button
            type="submit"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
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
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {post.comments.map((comment) => (
            <div key={comment.id} className="text-sm">
              <span className="font-semibold">{comment.author.full_name}</span>{" "}
              <span className="text-foreground">{comment.content}</span>
            </div>
          ))}
        </div>
      )}

      <form action={addComment.bind(null, post.id)} className="mt-3 flex gap-2">
        <Input name="content" placeholder="Add a comment…" maxLength={500} className="h-9" />
        <button type="submit" className="text-sm font-medium text-primary hover:underline">
          Post
        </button>
      </form>
    </Card>
  );
}
