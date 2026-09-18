import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Award, Bell, BellOff, Pin, PinOff } from "lucide-react";
import {
  communityAuthorDisplay,
  getCommunityPoll,
  getCommunityReplies,
  getCommunityThread,
  getCurrentProfile,
} from "@/lib/data";
import {
  markCommunityThreadRead,
  setCommunityBestReply,
  setCommunityReplyReaction,
  setCommunityThreadPinned,
  setCommunityThreadReaction,
  toggleCommunityThreadFollow,
  voteCommunityPoll,
} from "@/lib/actions/community";
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
import { cn, postImageCssAspectRatio, timeAgo } from "@/lib/utils";

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

  const [replies, poll] = await Promise.all([
    getCommunityReplies(id, viewer.id),
    getCommunityPoll(id, viewer.id),
  ]);

  // Clears this thread's unread dot on the list page the instant it's
  // opened — a nice-to-have, not critical to showing the thread, so a
  // failure here shouldn't take the page down (mirrors app/notifications/
  // page.tsx's own markAllNotificationsRead call site).
  try {
    await markCommunityThreadRead(id);
  } catch (err) {
    console.error("markCommunityThreadRead failed:", err);
  }

  const author = communityAuthorDisplay(thread, viewer.id);
  const isOwnThread = thread.author.id === viewer.id;

  // The best-marked reply (if any) floats to the top; everyone else keeps
  // their normal chronological order — a stable partial sort, not a full
  // re-sort, so the discussion still reads top-to-bottom underneath it.
  const sortedReplies = thread.best_reply_id
    ? [...replies].sort((a, b) => {
        if (a.id === thread.best_reply_id) return -1;
        if (b.id === thread.best_reply_id) return 1;
        return 0;
      })
    : replies;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <BackLink fallbackHref="/community" aria-label="Back to community">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <Badge variant="outline">{thread.topic.name}</Badge>
        {thread.is_pinned && (
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Pin className="h-3 w-3" />
            Pinned
          </span>
        )}
      </div>

      <Card className="p-6">
        <h1 className="text-xl font-bold text-foreground">{thread.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar name={author.name} src={author.avatarUrl} size={24} />
          {author.username ? (
            <Link href={`/profile/${author.username}`} className="font-medium text-foreground hover:underline">
              {author.name}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{author.name}</span>
          )}
          <span>·</span>
          <span>{timeAgo(thread.created_at)}</span>

          <div className="ml-auto flex items-center gap-1">
            {/* Author-only, no site-wide admin/moderator role in this app
                — pinning is deliberately scoped to "curate your own
                thread," see lib/actions/community.ts's own comment. */}
            {isOwnThread && (
              <form action={setCommunityThreadPinned.bind(null, thread.id, !thread.is_pinned)}>
                <button
                  type="submit"
                  title={thread.is_pinned ? "Unpin" : "Pin this thread"}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {thread.is_pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </button>
              </form>
            )}
            {/* Replying already auto-follows (createCommunityReply) — this
                is for watching without posting, or opting back out. */}
            <form action={toggleCommunityThreadFollow.bind(null, thread.id, thread.isFollowing)}>
              <button
                type="submit"
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
                  thread.isFollowing
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {thread.isFollowing ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
                {thread.isFollowing ? "Following" : "Follow"}
              </button>
            </form>
            {isOwnThread && <DeleteCommunityThreadButton threadId={thread.id} />}
          </div>
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
          {thread.image_url && (
            <div
              className="relative mt-3 w-full overflow-hidden rounded-lg border border-border"
              style={{ aspectRatio: postImageCssAspectRatio({ imageWidth: thread.image_width, imageHeight: thread.image_height }) }}
            >
              <Image
                src={thread.image_url}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 672px"
                quality={60}
                className="object-cover"
              />
            </div>
          )}
        </DoubleTapReact>

        {poll && (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {poll.options.map((option) => {
              const pct = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
              const isMine = option.id === poll.myOptionId;
              return (
                <form key={option.id} action={voteCommunityPoll.bind(null, thread.id, option.id)}>
                  <button
                    type="submit"
                    className={cn(
                      "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      isMine ? "border-primary" : "border-border hover:bg-muted",
                    )}
                  >
                    <span
                      className="absolute inset-y-0 left-0 bg-primary/15"
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                    <span className="relative flex items-center justify-between gap-2">
                      <span className={cn(isMine && "font-medium text-primary")}>{option.label}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{pct}%</span>
                    </span>
                  </button>
                </form>
              );
            })}
            <p className="text-xs text-muted-foreground">
              {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"}
            </p>
          </div>
        )}

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

        {sortedReplies.map((reply) => {
          const isBest = reply.id === thread.best_reply_id;
          return (
            <div key={reply.id} className="flex items-start gap-2 text-sm">
              <Link href={`/profile/${reply.author.username}`} className="shrink-0">
                <Avatar name={reply.author.full_name} src={reply.author.avatar_url} size={28} />
              </Link>
              <div className="min-w-0 flex-1">
                {isBest && (
                  <p className="mb-1 flex items-center gap-1 pl-3 text-xs font-medium text-primary">
                    <Award className="h-3.5 w-3.5" />
                    Best answer
                  </p>
                )}
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
                  className={cn(
                    "rounded-2xl px-3 py-2 transition-colors",
                    isBest ? "border border-primary/40 bg-primary/5 hover:bg-primary/10" : "bg-muted hover:bg-muted/80",
                  )}
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
                  {/* Only the thread's own author can mark a best answer —
                      matches pinning's "curate your own thread" scope,
                      enforced server-side too (set_community_best_reply
                      RPC, 0031_community_round3.sql). */}
                  {isOwnThread && (
                    <form
                      action={setCommunityBestReply.bind(null, thread.id, isBest ? null : reply.id)}
                      className="ml-auto"
                    >
                      <button
                        type="submit"
                        title={isBest ? "Unmark as best answer" : "Mark as best answer"}
                        className={cn(
                          "flex items-center gap-1 font-medium hover:text-primary",
                          isBest && "text-primary",
                        )}
                      >
                        <Award className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  )}
                  {reply.author.id === viewer.id && (
                    <DeleteCommunityReplyButton
                      replyId={reply.id}
                      threadId={thread.id}
                      className={isOwnThread ? "" : "ml-auto"}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <CommunityReplyComposer threadId={thread.id} />
      </div>
    </div>
  );
}
