import { MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TransitionLink } from "@/components/transition-link";
import { timeAgo } from "@/lib/utils";
import type { CommunityThreadListItem } from "@/lib/data";

/** One row in the /community thread list — links into the thread. */
export function CommunityThreadRow({ thread }: { thread: CommunityThreadListItem }) {
  return (
    <TransitionLink href={`/community/${thread.id}`} direction="forward" className="block">
      <Card className="p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline">{thread.topic.name}</Badge>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(thread.last_activity_at)}
          </span>
        </div>
        <h2 className="mt-2 font-semibold text-foreground">{thread.title}</h2>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{thread.body}</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar name={thread.author.full_name} src={thread.author.avatar_url} size={20} />
          <span className="truncate">{thread.author.full_name}</span>
          <span>·</span>
          <span className="flex shrink-0 items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {thread.reply_count}
          </span>
        </div>
      </Card>
    </TransitionLink>
  );
}
