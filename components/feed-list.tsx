import type { FeedItem } from "@/lib/data";
import { PostCard } from "@/components/post-card";
import { SharedPostCard } from "@/components/shared-post-card";

/** Renders a list of feed items — original posts and reposts alike. */
export function FeedList({ items }: { items: FeedItem[] }) {
  return (
    <>
      {items.map((item) =>
        item.type === "post" ? (
          <PostCard key={`post-${item.post.id}`} post={item.post} />
        ) : (
          <SharedPostCard
            key={`share-${item.sharer.id}-${item.post.id}`}
            sharer={item.sharer}
            post={item.post}
            sharedAt={item.sortAt}
          />
        ),
      )}
    </>
  );
}
