import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn, timeAgo } from "@/lib/utils";
import type { ChatConversation } from "@/lib/data";

/** One row in the /chat list — links straight into the thread. */
export function ConversationRow({ conversation }: { conversation: ChatConversation }) {
  const { otherUser, lastMessage, unreadCount } = conversation;
  const unread = unreadCount > 0;

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50"
    >
      <Avatar name={otherUser.full_name} src={otherUser.avatar_url} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{otherUser.full_name}</p>
          {lastMessage && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeAgo(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <p
          className={cn(
            "truncate text-xs",
            unread ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
        >
          {lastMessage ? `${lastMessage.isOwn ? "You: " : ""}${lastMessage.content}` : "Say hi 👋"}
        </p>
      </div>
      {unread && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
