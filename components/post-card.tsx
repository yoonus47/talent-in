"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageCircle, Repeat2 } from "lucide-react";
import type { FeedAuthor, FeedPost } from "@/lib/data";
import { setReaction, toggleShare } from "@/lib/actions/posts";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { DeletePostButton } from "@/components/delete-post-button";
import { ReactionRow } from "@/components/reaction-row";
import { ReactionSummary } from "@/components/reaction-summary";
import { DoubleTapReact, DOUBLE_TAP_REACTION } from "@/components/double-tap-react";
import { PostImage } from "@/components/post-image";
import { PostContent } from "@/components/post-content";
import { LinkPreviewCard } from "@/components/link-preview-card";
import { PostComments } from "@/components/post-comments";
import { MentionInput } from "@/components/mention-input";
import { extractFirstUrl } from "@/lib/links";
import { cn, timeAgo } from "@/lib/utils";

function countAllComments(post: FeedPost): number {
  return post.comments.reduce((total, c) => total + 1 + c.replies.length, 0);
}

/**
 * A single feed post — header, content/media, reactions, and a comment
 * section that's collapsed by default (see `open` below) with a compose
 * box always available underneath it, expanded or not.
 *
 * Client component (not just for the comment toggle's own state, but
 * because that state has to be shared between two siblings — the count
 * badge in the action row and the list itself, rendered many lines apart
 * in this same tree — so it has to live here, not in either child).
 */
export function PostCard({ post, viewer }: { post: FeedPost; viewer: FeedAuthor }) {
  // Comments are opt-in, not opt-out: a post with 40 comments used to
  // dump its most recent two into every single feed load whether anyone
  // asked for them or not. Now nothing renders until the count badge
  // itself is tapped — posting your own top-level comment (below) also
  // opens it, since typing one is a pretty clear signal you want to see
  // where it landed.
  const [open, setOpen] = useState(false);

  // A post never stacks two "media-like" blocks — a link preview only
  // shows up when there's no uploaded photo. Matches lib/data.ts's
  // getFeedItems, which only ever populates post.linkPreview under the
  // same condition.
  const previewUrl = post.image_url ? null : extractFirstUrl(post.content);
  const commentCount = countAllComments(post);

  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${post.author.username}`}>
          <Avatar name={post.author.full_name} src={post.author.avatar_url} size={40} />
        </Link>
        <div className="flex-1">
          <Link
            href={`/profile/${post.author.username}`}
            className="text-sm font-semibold hover:underline"
          >
            {post.author.full_name}
          </Link>
          <p className="text-xs text-muted-foreground">
            @{post.author.username} · {timeAgo(post.created_at)}
          </p>
        </div>
        {post.isOwnPost && <DeletePostButton postId={post.id} />}
      </div>

      <DoubleTapReact
        className="mt-3"
        myReaction={post.myReaction}
        reactAction={setReaction.bind(
          null,
          post.id,
          post.author.id,
          DOUBLE_TAP_REACTION,
          post.myReaction,
        )}
      >
        <p className="text-sm text-foreground">
          <PostContent content={post.content} />
        </p>
      </DoubleTapReact>

      {/* The image gets its own tap handling (single tap opens the
          lightbox, double tap reacts) — separate from the text's
          DoubleTapReact above, which only ever reacts. */}
      <PostImage post={post} />

      {previewUrl && <LinkPreviewCard url={previewUrl} initialPreview={post.linkPreview} />}

      <div className="mt-3">
        <ReactionSummary counts={post.reactionCounts} />
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-border pt-3">
        <ReactionRow
          counts={post.reactionCounts}
          myReaction={post.myReaction}
          buildAction={(type) =>
            setReaction.bind(null, post.id, post.author.id, type, post.myReaction)
          }
        />

        {/* The one and only way comments become visible — a plain count
            used to just sit here as inert text while PostComments quietly
            rendered its own preview underneath regardless of whether
            anyone had asked to see it. Disabled (no hover, no chevron)
            once there's nothing to expand, rather than toggling `open`
            for an empty list. */}
        <button
          type="button"
          onClick={() => commentCount > 0 && setOpen((v) => !v)}
          disabled={commentCount === 0}
          aria-expanded={open}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors",
            commentCount > 0 && "hover:bg-muted hover:text-foreground",
          )}
        >
          <MessageCircle className="h-4 w-4" />
          {commentCount}
          {commentCount > 0 && (
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")}
            />
          )}
        </button>
        <form action={toggleShare.bind(null, post.id, post.author.id, post.sharedByMe)}>
          <button
            type="submit"
            className="flex items-center gap-1.5 pl-3 text-sm text-muted-foreground hover:text-primary"
          >
            <Repeat2
              className="h-4 w-4"
              color={post.sharedByMe ? "var(--primary)" : "currentColor"}
            />
            {post.shareCount}
          </button>
        </form>
      </div>

      {open && commentCount > 0 && (
        <div className="animate-comments-reveal mt-3 border-t border-border pt-3">
          <PostComments comments={post.comments} postId={post.id} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Hide comments
          </button>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2">
        <Avatar name={viewer.full_name} src={viewer.avatar_url} size={28} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <MentionInput
            postId={post.id}
            recipientId={post.author.id}
            parentCommentId={null}
            placeholder="Add a comment…"
            // Posting your own comment while the section is collapsed
            // would otherwise leave it swallowed with no feedback that it
            // actually went anywhere — opening on submit is the one
            // exception to "only the user's own tap expands this."
            onSubmitted={() => setOpen(true)}
          />
        </div>
      </div>
    </Card>
  );
}
