import type { FeedAuthor, FeedItem } from "@/lib/data";
import { PostCard } from "@/components/post-card";
import { SharedPostCard } from "@/components/shared-post-card";

// A one-time staggered entrance on initial load only — there's no
// infinite scroll here (see components/end-of-feed.tsx's own header
// comment on why that's deliberate), so this never replays mid-scroll the
// way a naive "animate every card that enters the viewport" approach
// would. Capped so a long feed's later items don't end up with an
// absurdly long, increasingly-laggy-feeling delay.
const STAGGER_MS = 70;
const MAX_STAGGER_ITEMS = 6;

/** Renders a list of feed items — original posts and reposts alike. */
export function FeedList({ items, viewer }: { items: FeedItem[]; viewer: FeedAuthor }) {
  return (
    <>
      {items.map((item, i) => {
        const delay = `${Math.min(i, MAX_STAGGER_ITEMS) * STAGGER_MS}ms`;
        return (
          <div
            key={item.type === "post" ? `post-${item.post.id}` : `share-${item.sharer.id}-${item.post.id}`}
            className="animate-fade-up"
            style={{ animationDelay: delay }}
          >
            {item.type === "post" ? (
              <PostCard post={item.post} viewer={viewer} />
            ) : (
              <SharedPostCard sharer={item.sharer} post={item.post} sharedAt={item.sortAt} viewer={viewer} />
            )}
          </div>
        );
      })}
    </>
  );
}
