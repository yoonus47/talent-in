import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { cn, timeAgo } from "@/lib/utils";
import type { ChatConversation } from "@/lib/data";

/** One row in the /chat list — links straight into the thread. Group rows
 * reuse Avatar's initials fallback with the group's own name as the
 * "avatar" (no group-photo upload in v1) and prefix the preview with
 * whoever sent it; dm rows are unchanged. */
export function ConversationRow({ conversation }: { conversation: ChatConversation }) {
  const { type, title, avatarUrl, lastMessage, unreadCount, memberCount } = conversation;
  const unread = unreadCount > 0;

  const preview = lastMessage
    ? lastMessage.isOwn
      ? `You: ${lastMessage.content}`
      : type === "group" && lastMessage.senderName
        ? `${lastMessage.senderName}: ${lastMessage.content}`
        : lastMessage.content
    : type === "group"
      ? "Say hi to the group 👋"
      : "Say hi 👋";

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
        unread && "bg-primary/5",
      )}
    >
      <Avatar name={title} src={avatarUrl} size={48} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          {lastMessage && (
            <span className="shrink-0 text-xs text-muted-foreground">
              {timeAgo(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <p className={cn("truncate text-xs", unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {preview}
        </p>
        {type === "group" && (
          <p className="truncate text-[11px] text-muted-foreground">
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </p>
        )}
      </div>
      {unread && (
        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
