"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { setReaction } from "@/lib/actions/posts";
import type { FeedPost } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { ReactionRow } from "@/components/reaction-row";
import { ReactionSummary } from "@/components/reaction-summary";
import { cn, timeAgo } from "@/lib/utils";

const DEFAULT_HEIGHT_RATIO = 4 / 5; // used when dimensions weren't captured (legacy posts)

/**
 * The "tap to open" full view: the image at its true, unclamped aspect
 * ratio (uncropped — there's no feed layout to protect here) and quality
 * 90, well above the feed's 60. Scoped to "see the photo properly" —
 * comments stay on the main feed card, not re-homed in here.
 */
export function PostLightbox({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!post.image_url) return null;

  // CSS's `aspect-ratio` is width/height — inverting the natural
  // height/width ratio here (same bug caught live in PostImage).
  const trueCssAspectRatio = post.imageWidth && post.imageHeight
    ? post.imageWidth / post.imageHeight
    : 1 / DEFAULT_HEIGHT_RATIO;

  return (
    <div
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 transition-opacity duration-200",
        mounted ? "opacity-100" : "opacity-0",
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg bg-card transition-all duration-200",
          mounted ? "scale-100 opacity-100" : "scale-95 opacity-0",
        )}
      >
        <div
          className="relative w-full max-h-[70vh] shrink-0 bg-black"
          style={{ aspectRatio: trueCssAspectRatio }}
        >
          <Image
            src={post.image_url}
            alt=""
            fill
            sizes="100vw"
            quality={90}
            className="object-contain"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex items-center gap-2.5">
            <Link href={`/profile/${post.author.username}`} onClick={onClose}>
              <Avatar name={post.author.full_name} src={post.author.avatar_url} size={36} />
            </Link>
            <div>
              <Link
                href={`/profile/${post.author.username}`}
                onClick={onClose}
                className="text-sm font-semibold hover:underline"
              >
                {post.author.full_name}
              </Link>
              <p className="text-xs text-muted-foreground">
                @{post.author.username} · {timeAgo(post.created_at)}
              </p>
            </div>
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{post.content}</p>

          <div className="mt-3">
            <ReactionSummary counts={post.reactionCounts} />
          </div>
          <div className="mt-1 border-t border-border pt-3">
            <ReactionRow
              counts={post.reactionCounts}
              myReaction={post.myReaction}
              buildAction={(type) =>
                setReaction.bind(null, post.id, post.author.id, type, post.myReaction)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
