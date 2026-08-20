import Link from "next/link";
import { Repeat2 } from "lucide-react";
import type { FeedAuthor, FeedPost } from "@/lib/data";
import { PostCard } from "@/components/post-card";
import { timeAgo } from "@/lib/utils";

export function SharedPostCard({
  sharer,
  post,
  sharedAt,
}: {
  sharer: FeedAuthor & { id: string };
  post: FeedPost;
  sharedAt: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
        <Repeat2 className="h-3.5 w-3.5" />
        <Link href={`/profile/${sharer.username}`} className="font-medium hover:underline">
          {sharer.full_name}
        </Link>
        shared this · {timeAgo(sharedAt)}
      </div>
      <PostCard post={post} />
    </div>
  );
}
