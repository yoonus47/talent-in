import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCommunityReplies, getCommunityThread, getCurrentProfile } from "@/lib/data";
import { markCommunityThreadRead, setCommunityReplyReaction, setCommunityThreadReaction } from "@/lib/actions/community";
import { BackLink } from "@/components/back-link";
import { CommunityReplyComposer } from "@/components/community-reply-composer";
import { DeleteCommunityReplyButton } from "@/components/delete-community-reply-button";
import { DeleteCommunityThreadButton } from "@/components/delete-community-thread-button";
import { DoubleTapReact, DOUBLE_TAP_REACTION } from "@/components/double-tap-react";
import { ReactionRow } from "@/components/reaction-row";
import { ReactionSummary } from "@/components/reaction-summary";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

export default async function CommunityThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/onboarding");

  const { id } = await params;
  const thread = await getCommunityThread(id, viewer.id);
  if (!thread) notFound();

  const replies = await getCommunityReplies(id, viewer.id);

  // Clears this thread's unread dot on the list page the instant it's
  // opened — a nice-to-have, not critical to showing the thread, so a
  // failure here shouldn't take the page down (mirrors app/notifications/
  // page.tsx's own markAllNotificationsRead call site).
  try {
    await markCommunityThreadRead(id);
  } catch (err) {
    console.error("markCommunityThreadRead failed:", err);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <BackLink fallbackHref="/community" aria-label="Back to community">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <Badge variant="outline">{thread.topic.name}</Badge>
      </div>

      <Card className="p-6">
        <h1 className="text-xl font-bold text-foreground">{thread.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar name={thread.author.full_name} src={thread.author.avatar_url} size={24} />
          <Link
            href={`/profile/${thread.author.username}`}
            className="font-medium text-foreground hover:underline"
          >
            {thread.author.full_name}
          </Link>
          <span>·</span>
          <span>{timeAgo(thread.created_at)}</span>
          {thread.author.id === viewer.id && (
            <DeleteCommunityThreadButton threadId={thread.id} className="ml-auto" />
          )}
        </div>

        <DoubleTapReact
          className="mt-4"
          myReaction={thread.myReaction}
          reactAction={setCommunityThreadReaction.bind(
            null,
            thread.id,
            thread.author.id,
            DOUBLE_TAP_REACTION,
            thread.myReaction,
          )}
        >
          <p className="whitespace-pre-wrap text-sm text-foreground">{thread.body}</p>
        </DoubleTapReact>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <ReactionRow
            counts={thread.reactionCounts}
            myReaction={thread.myReaction}
            buildAction={(type) =>
              setCommunityThreadReaction.bind(null, thread.id, thread.author.id, type, thread.myReaction)
            }
          />
          <ReactionSummary counts={thread.reactionCounts} />
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </h2>

        {replies.map((reply) => (
          <div key={reply.id} className="flex items-start gap-2 text-sm">
            <Link href={`/profile/${reply.author.username}`} className="shrink-0">
              <Avatar name={reply.author.full_name} src={reply.author.avatar_url} size={28} />
            </Link>
            <div className="min-w-0 flex-1">
              <DoubleTapReact
                myReaction={reply.myReaction}
                reactAction={setCommunityReplyReaction.bind(
                  null,
                  reply.id,
                  thread.id,
                  reply.author.id,
                  DOUBLE_TAP_REACTION,
                  reply.myReaction,
                )}
                className="rounded-2xl bg-muted px-3 py-2 transition-colors hover:bg-muted/80"
              >
                {/* No onClick stopPropagation here (unlike components/
                    comment-thread.tsx's own CommentRow, which can afford
                    one — it's a Client Component itself) — this whole
                    page is a Server Component, and an event handler
                    can't cross into DoubleTapReact's children from here.
                    Harmless to omit: a single click just starts
                    DoubleTapReact's own tap timer alongside the Link's
                    normal navigation, it doesn't block it. */}
                <Link
                  href={`/profile/${reply.author.username}`}
                  className="text-xs font-semibold text-foreground hover:underline"
                >
                  {reply.author.full_name}
                </Link>
                <p className="mt-0.5 whitespace-pre-wrap text-foreground">{reply.content}</p>
              </DoubleTapReact>
              <div className="mt-0.5 flex items-center gap-3 pl-3 text-xs text-muted-foreground">
                <span>{timeAgo(reply.created_at)}</span>
                <ReactionSummary counts={reply.reactionCounts} size="sm" />
                <ReactionRow
                  size="sm"
                  counts={reply.reactionCounts}
                  myReaction={reply.myReaction}
                  buildAction={(type) =>
                    setCommunityReplyReaction.bind(null, reply.id, thread.id, reply.author.id, type, reply.myReaction)
                  }
                />
                {reply.author.id === viewer.id && (
                  <DeleteCommunityReplyButton
                    replyId={reply.id}
                    threadId={thread.id}
                    className="ml-auto"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <CommunityReplyComposer threadId={thread.id} recipientId={thread.author.id} />
      </div>
    </div>
  );
}
