"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { setReaction } from "@/lib/actions/posts";
import { DOUBLE_TAP_REACTION } from "@/components/double-tap-react";
import { PostLightbox } from "@/components/post-lightbox";
import { REACTIONS } from "@/lib/reactions";
import type { FeedPost } from "@/lib/data";
import { cn, postImageCssAspectRatio } from "@/lib/utils";

const SINGLE_TAP_DELAY_MS = 300;

/**
 * The feed's version of a post's image: quality 60, the photo's own true
 * aspect ratio (no cropping — a tall photo gets a taller card, same as X's
 * timeline; the box's *height* adapts to fit the feed's fixed width, not
 * the other way around). A single tap opens the full-quality lightbox; a
 * double tap reacts instead — the standard trade-off of disambiguating the
 * two gestures is a short delay before a genuine single tap opens
 * anything, same cost every app doing this pays.
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
        style={{ aspectRatio: postImageCssAspectRatio(post) }}
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
