import Link from "next/link";
import { redirect } from "next/navigation";
import { AtSign, Heart, MessageCircle, Reply, Repeat2, UserPlus } from "lucide-react";
import { getCurrentProfile, getNotifications, type FeedNotification } from "@/lib/data";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { REACTIONS } from "@/lib/reactions";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

function describe(n: FeedNotification): string {
  switch (n.type) {
    case "follow":
      return "started following you";
    case "comment":
      return "commented on your post";
    case "share":
      return "shared your post";
    case "reaction": {
      const reaction = REACTIONS.find((r) => r.type === n.reactionType);
      return `reacted ${reaction?.emoji ?? ""} to your post`;
    }
    case "reply":
      return "replied to your comment";
    case "mention":
      return "tagged you in a comment";
    case "comment_reaction": {
      const reaction = REACTIONS.find((r) => r.type === n.reactionType);
      return `reacted ${reaction?.emoji ?? ""} to your comment`;
    }
  }
}

function iconFor(type: FeedNotification["type"]) {
  switch (type) {
    case "follow":
      return UserPlus;
    case "comment":
      return MessageCircle;
    case "share":
      return Repeat2;
    case "reaction":
    case "comment_reaction":
      return Heart;
    case "reply":
      return Reply;
    case "mention":
      return AtSign;
    default:
      return Heart;
  }
}

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const notifications = await getNotifications(profile.id);

  // Marking as read is a nice-to-have side effect, not critical to showing
  // the list — never let a failure here take down the whole page.
  try {
    await markAllNotificationsRead(profile.id);
  } catch (err) {
    console.error("markAllNotificationsRead failed:", err);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold">Notifications</h1>

      {notifications.length === 0 ? (
        <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">
          Nothing yet. When someone follows you, reacts, comments, or shares your posts,
          you&apos;ll see it here.
        </Card>
      ) : (
        <Card className="mt-4 divide-y divide-border px-4">
          {notifications.map((n) => {
            const Icon = iconFor(n.type);
            const href =
              n.type === "follow" ? `/profile/${n.actor.username}` : n.post ? "/feed" : "/feed";
            return (
              <Link
                key={n.id}
                href={href}
                className="flex items-start gap-3 py-3 hover:bg-muted"
              >
                <div className="relative shrink-0">
                  <Avatar name={n.actor.full_name} src={n.actor.avatar_url} size={40} />
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-card text-primary ring-2 ring-card">
                    <Icon className="h-3 w-3" />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{n.actor.full_name}</span>{" "}
                    {describe(n)}
                  </p>
                  {(n.comment ?? n.post) && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {(n.comment ?? n.post)?.content}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </Card>
      )}
    </div>
  );
}
