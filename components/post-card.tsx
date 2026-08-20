import Link from "next/link";
import { MessageCircle, Repeat2 } from "lucide-react";
import type { FeedPost } from "@/lib/data";
import { addComment, setReaction, toggleShare } from "@/lib/actions/posts";
import { REACTIONS } from "@/lib/reactions";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn, timeAgo } from "@/lib/utils";

export function PostCard({ post }: { post: FeedPost }) {
  const totalReactions = Object.values(post.reactionCounts).reduce((a, b) => a + b, 0);

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

      {post.image_url && (
        // Plain <img>, not next/image: post images can point at any host a
        // student pastes, not just our own Supabase Storage domain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.image_url}
          alt=""
          className="mt-3 max-h-96 w-full rounded-lg border border-border object-cover"
        />
      )}

      {totalReactions > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          {REACTIONS.filter((r) => post.reactionCounts[r.type] > 0)
            .map((r) => r.emoji)
            .join(" ")}{" "}
          {totalReactions}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        {REACTIONS.map((reaction) => {
          const isMine = post.myReaction === reaction.type;
          const count = post.reactionCounts[reaction.type];
          return (
            <form key={reaction.type} action={setReaction.bind(null, post.id, reaction.type, post.myReaction)}>
              <button
                type="submit"
                title={reaction.label}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-1 text-sm hover:bg-muted",
                  isMine && "bg-primary/10 text-primary",
                )}
              >
                <span>{reaction.emoji}</span>
                {count > 0 && <span className="text-xs">{count}</span>}
              </button>
            </form>
          );
        })}

        <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          {post.comments.length}
        </span>
        <form action={toggleShare.bind(null, post.id, post.sharedByMe)}>
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
