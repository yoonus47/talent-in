"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { setReaction } from "@/lib/actions/posts";
import { DOUBLE_TAP_REACTION } from "@/components/double-tap-react";
import { PostLightbox } from "@/components/post-lightbox";
import { REACTIONS } from "@/lib/reactions";
import type { FeedPost } from "@/lib/data";
import { cn } from "@/lib/utils";

// Instagram's own band: 4:5 portrait to 1.91:1 landscape, expressed here as
// height/width so one extreme photo (a very tall portrait, a panorama)
// can't dominate the feed. Anything outside it gets center-cropped in the
// feed only — the lightbox always shows the true, unclamped ratio.
const MIN_HEIGHT_RATIO = 1 / 1.91;
const MAX_HEIGHT_RATIO = 5 / 4;
const DEFAULT_HEIGHT_RATIO = 4 / 5; // used when dimensions weren't captured (legacy posts)

const SINGLE_TAP_DELAY_MS = 300;

/** CSS's `aspect-ratio` is width/height, not height/width — inverting this
 * was a real bug caught live (a tall portrait rendered as a wide box). This
 * clamps the *height/width* ratio into the Instagram-like band first (the
 * intuitive direction — "how many times taller than wide"), then inverts
 * once at the end for the one place CSS actually wants it. */
function clampedFeedCssAspectRatio(post: FeedPost): number {
  const heightOverWidth =
    post.imageWidth && post.imageHeight ? post.imageHeight / post.imageWidth : DEFAULT_HEIGHT_RATIO;
  const clamped = Math.min(MAX_HEIGHT_RATIO, Math.max(MIN_HEIGHT_RATIO, heightOverWidth));
  return 1 / clamped;
}

/**
 * The feed's version of a post's image: quality 60, aspect ratio clamped
 * into an Instagram-like band, cropped (not stretched) to fit it. A single
 * tap opens the full-quality lightbox; a double tap reacts instead — the
 * standard trade-off of disambiguating the two gestures is a short delay
 * before a genuine single tap opens anything, same cost every app doing
 * this pays.
 */
export function PostImage({ post }: { post: FeedPost }) {
  const [burst, setBurst] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleTap() {
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < SINGLE_TAP_DELAY_MS;
    lastTapRef.current = isDoubleTap ? 0 : now;

    if (isDoubleTap) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      if (post.myReaction !== DOUBLE_TAP_REACTION) formRef.current?.requestSubmit();
      setBurst(true);
      setTimeout(() => setBurst(false), 600);
    } else {
      singleTapTimerRef.current = setTimeout(() => {
        setLightboxOpen(true);
      }, SINGLE_TAP_DELAY_MS);
    }
  }

  const emoji = REACTIONS.find((r) => r.type === DOUBLE_TAP_REACTION)?.emoji ?? "❤️";

  if (!post.image_url) return null;

  return (
    <>
      <div
        onClick={handleTap}
        className="relative mt-3 w-full touch-manipulation select-none overflow-hidden rounded-lg border border-border"
        style={{ aspectRatio: clampedFeedCssAspectRatio(post) }}
      >
        <Image
          src={post.image_url}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 544px"
          quality={60}
          className="object-cover"
        />
        <form
          ref={formRef}
          action={setReaction.bind(
            null,
            post.id,
            post.author.id,
            DOUBLE_TAP_REACTION,
            post.myReaction,
          )}
          className="hidden"
        />
        {burst && (
          <span
            className={cn(
              "pointer-events-none absolute inset-0 flex items-center justify-center text-5xl",
              "animate-[ping_0.6s_ease-out]",
            )}
          >
            {emoji}
          </span>
        )}
      </div>

      {lightboxOpen && <PostLightbox post={post} onClose={() => setLightboxOpen(false)} />}
    </>
  );
}
