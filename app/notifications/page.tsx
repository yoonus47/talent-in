import Link from "next/link";
import { redirect } from "next/navigation";
import { AtSign, Award, Heart, MessageCircle, Reply, Repeat2, UserPlus, Users } from "lucide-react";
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
      return n.conversation ? "mentioned you in a group message" : "tagged you in a comment";
    case "comment_reaction": {
      const reaction = REACTIONS.find((r) => r.type === n.reactionType);
      return `reacted ${reaction?.emoji ?? ""} to your comment`;
    }
    case "group_added":
      return `added you to "${n.conversation?.name ?? "a group"}"`;
    // Relationship-agnostic on purpose — the recipient might be the
    // thread's author, or just someone who replied earlier and is now
    // following it (community_thread_follows, 0031_community_round3.sql
    // — createCommunityReply notifies every follower, not just the
    // author). The preview line below already names the thread/reply, so
    // "your thread" would be actively wrong for a follower who isn't the
    // author.
    case "community_reply":
      return "posted a new reply";
    case "community_mention":
      return "mentioned you in a community reply";
    case "community_reaction": {
      const reaction = REACTIONS.find((r) => r.type === n.reactionType);
      return `reacted ${reaction?.emoji ?? ""} to your community ${n.communityReply ? "reply" : "thread"}`;
    }
    case "community_best_answer":
      return "marked your reply as the best answer";
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
    case "community_mention":
      return AtSign;
    case "group_added":
      return Users;
    case "community_reply":
      return Reply;
    case "community_reaction":
      return Heart;
    case "community_best_answer":
      return Award;
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
            const isCommunity =
              n.type === "community_reply" ||
              n.type === "community_mention" ||
              n.type === "community_reaction" ||
              n.type === "community_best_answer";
            const href =
              n.type === "follow"
                ? `/profile/${n.actor.username}`
                : (n.type === "group_added" || n.type === "mention") && n.conversation
                  ? `/chat/${n.conversation.id}`
                  : isCommunity && n.communityThread
                    ? `/community/${n.communityThread.id}`
                    : n.post
                      ? "/feed"
                      : "/feed";
            const previewText =
              n.comment?.content ?? n.post?.content ?? n.communityReply?.content ?? n.communityThread?.title ?? null;
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
                  {previewText && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{previewText}</p>
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
