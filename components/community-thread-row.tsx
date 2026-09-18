import { MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReactionSummary } from "@/components/reaction-summary";
import { TransitionLink } from "@/components/transition-link";
import { communityAuthorDisplay } from "@/lib/data";
import { timeAgo } from "@/lib/utils";
import type { CommunityThreadListItem } from "@/lib/data";

/** One row in the /community thread list — links into the thread. The
 * small dot next to the timestamp mirrors app/notifications/page.tsx's
 * own unread treatment (same h-2 w-2 rounded-full bg-primary), shown when
 * `thread.isNew` — activity since this viewer last opened it (or never
 * opened at all), see lib/data.ts's getCommunityThreads. */
export function CommunityThreadRow({
  thread,
  viewerId,
}: {
  thread: CommunityThreadListItem;
  /** Needed only to resolve whether *this viewer* should see the real
   * author or "Anonymous" — see lib/data.ts's communityAuthorDisplay. */
  viewerId: string;
}) {
  const author = communityAuthorDisplay(thread, viewerId);

  return (
    <TransitionLink href={`/community/${thread.id}`} direction="forward" className="block">
      <Card className="p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">{thread.topic.name}</Badge>
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            {thread.isNew && <span className="h-2 w-2 rounded-full bg-primary" aria-label="New activity" />}
            {timeAgo(thread.last_activity_at)}
          </span>
        </div>
        <h2 className="mt-2 font-semibold text-foreground">{thread.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{thread.body}</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar name={author.name} src={author.avatarUrl} size={20} />
          <span className="truncate">{author.name}</span>
          <span>·</span>
          <span className="flex shrink-0 items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {thread.reply_count}
          </span>
          <ReactionSummary counts={thread.reactionCounts} size="sm" />
        </div>
      </Card>
    </TransitionLink>
  );
}
