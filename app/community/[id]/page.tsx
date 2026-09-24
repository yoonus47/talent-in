import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  BellOff,
  Bookmark,
  BookmarkCheck,
  Pin,
  PinOff,
  Share2,
  Trophy,
} from "lucide-react";
import {
  communityAuthorDisplay,
  getCommunityPoll,
  getCommunityReplies,
  getCommunityThread,
  getCurrentProfile,
} from "@/lib/data";
import {
  markCommunityThreadRead,
  setCommunityThreadPinned,
  setCommunityThreadReaction,
  toggleCommunityThreadFollow,
  toggleCommunityThreadSave,
  voteCommunityPoll,
} from "@/lib/actions/community";
import { BackLink } from "@/components/back-link";
import { CommunityReplyComposer } from "@/components/community-reply-composer";
import { CommunityReplyRow } from "@/components/community-reply-row";
import { DeleteCommunityThreadButton } from "@/components/delete-community-thread-button";
import { DoubleTapReact, DOUBLE_TAP_REACTION } from "@/components/double-tap-react";
import { ReactionRow } from "@/components/reaction-row";
import { ReactionSummary } from "@/components/reaction-summary";
import { ReportButton } from "@/components/report-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { FLAIR_LABELS } from "@/lib/community-flair";
import { cn, postImageCssAspectRatio, timeAgo } from "@/lib/utils";

export default async function CommunityThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ replySort?: string }>;
}) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/onboarding");

  const { id } = await params;
  const { replySort } = await searchParams;
  const sort = replySort === "top" ? "top" : "new";

  const thread = await getCommunityThread(id, viewer.id);
  if (!thread) notFound();

  const [replies, poll] = await Promise.all([
    getCommunityReplies(id, viewer.id, sort),
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
  const totalReplyCount = replies.reduce((sum, r) => sum + 1 + r.replies.length, 0);

  // The best-marked reply's *top-level* thread floats to the very top,
  // regardless of New/Top sort — unchanged from round 3, just re-targeted
  // at a top-level reply's id now that replies can nest one level. If the
  // best reply is itself nested, its parent (whole sub-thread, not just
  // the one bubble) floats up instead — pulling only the nested reply out
  // of its own context would read more confusingly than moving the pair
  // together. A stable partial reorder, not a full re-sort: everyone else
  // keeps whatever order New/Top already gave them.
  const bestTopLevelId = thread.best_reply_id
    ? replies.find(
        (r) => r.id === thread.best_reply_id || r.replies.some((child) => child.id === thread.best_reply_id),
      )?.id
    : undefined;
  const orderedReplies = bestTopLevelId
    ? [...replies.filter((r) => r.id === bestTopLevelId), ...replies.filter((r) => r.id !== bestTopLevelId)]
    : replies;

  const shareText = `"${thread.title}"\n\n${thread.body.slice(0, 200)}${thread.body.length > 200 ? "…" : ""}\n\n${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/community/${thread.id}`;

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <BackLink fallbackHref="/community" aria-label="Back to community">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <Badge variant="outline">{thread.topic.name}</Badge>
        {thread.flair && <Badge variant="outline">{FLAIR_LABELS[thread.flair]}</Badge>}
        {poll && <Badge variant="outline">📊 Poll</Badge>}
        {thread.best_reply_id && <Badge variant="outline">✓ Solved</Badge>}
        {thread.is_pinned && (
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Pin className="h-3 w-3" />
            Pinned
          </span>
        )}
      </div>

      <Card className="p-6">
        <h1 className="text-xl font-bold text-foreground">{thread.title}</h1>
        {/* flex-wrap: avatar + name + karma + timestamp on the left, then
            up to 5 action icons (pin/save/follow/share/report-or-delete)
            crammed into the ml-auto cluster on the right — confirmed this
            row's scrollWidth genuinely exceeded its clientWidth on a real
            phone width with a longer name, silently pushing the last
            icon(s) off past the card's edge instead of wrapping them down
            to their own line. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-muted-foreground">
          <Avatar name={author.name} src={author.avatarUrl} size={24} />
          {author.username ? (
            <Link href={`/profile/${author.username}`} className="font-medium text-foreground hover:underline">
              {author.name}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{author.name}</span>
          )}
          {/* No karma badge for an anonymous-to-this-viewer author — there's
              no real profile being shown to attach a number to. */}
          {author.username && thread.author.community_points > 0 && (
            <span
              title={`${thread.author.community_points} community points`}
              className="flex items-center gap-0.5 text-xs font-medium"
            >
              <Trophy className="h-3 w-3" />
              {thread.author.community_points}
            </span>
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
            {/* Save is a purely personal bookmark — no notifications
                implied, unlike Follow just below. */}
            <form action={toggleCommunityThreadSave.bind(null, thread.id, thread.isSaved)}>
              <button
                type="submit"
                title={thread.isSaved ? "Unsave" : "Save for later"}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {thread.isSaved ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>
            </form>
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
            {/* Crosspost-to-feed, deliberately lightweight: this opens the
                feed's own composer with an editable draft pre-filled, not
                an auto-posted rich embed card — see app/feed/page.tsx's
                own comment on why a true nested "shared thread" preview
                inside FeedPost was out of scope for this round. */}
            <Link
              href={`/feed?prefill=${encodeURIComponent(shareText)}`}
              title="Share to feed"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Share2 className="h-4 w-4" />
            </Link>
            {!isOwnThread && <ReportButton targetType="thread" targetId={thread.id} />}
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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {totalReplyCount} {totalReplyCount === 1 ? "reply" : "replies"}
          </h2>
          {replies.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <Link
                href={`/community/${id}`}
                className={cn("font-medium", sort === "new" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                New
              </Link>
              <Link
                href={`/community/${id}?replySort=top`}
                className={cn("font-medium", sort === "top" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                Top
              </Link>
            </div>
          )}
        </div>

        {orderedReplies.map((reply) => (
          <CommunityReplyRow
            key={reply.id}
            reply={reply}
            threadId={thread.id}
            viewerId={viewer.id}
            isOwnThread={isOwnThread}
            bestReplyId={thread.best_reply_id}
            depth={0}
          />
        ))}
      </div>

      <div className="mt-6">
        <CommunityReplyComposer threadId={thread.id} />
      </div>
    </div>
  );
}
