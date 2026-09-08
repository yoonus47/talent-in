"use client";

import { useEffect, useState } from "react";
import { getLinkPreview } from "@/lib/actions/link-preview";
import type { LinkPreview } from "@/lib/types/database";

/**
 * The Twitter/Discord/Slack-style unfurl card under a post's text — see
 * the "TalentZify — Link Preview Cards" plan for the full design.
 *
 * `initialPreview` comes from lib/data.ts's getFeedItems, a cache-read-only
 * batch lookup: `null` means no cache row existed for this URL at render
 * time (a genuinely new link — needs a live fetch, done here); an actual
 * row (status "ok" or "failed") is already final and needs no fetch at
 * all. This means the common case — a URL that's been posted before —
 * renders instantly with the rest of the feed, no skeleton, no client
 * round trip; only a brand-new link ever reaches getLinkPreview.
 */
export function LinkPreviewCard({
  url,
  initialPreview,
}: {
  url: string;
  initialPreview: LinkPreview | null;
}) {
  const [preview, setPreview] = useState(initialPreview);
  const [pending, setPending] = useState(() => initialPreview === null);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    // setPreview/setPending below run inside this .then() callback, not
    // synchronously in the effect body — the same "self-correcting live
    // fetch on mount" shape already used by notification-bell.tsx and
    // chat-fab-button.tsx.
    getLinkPreview(url).then((result) => {
      if (cancelled) return;
      setPreview(result);
      setPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [pending, url]);

  if (pending) {
    return (
      <div className="mt-3 h-20 animate-pulse rounded-lg border border-border bg-muted sm:h-24" />
    );
  }

  // No card for a known failure (nothing worth showing — the URL is
  // already a plain clickable link via components/post-content.tsx
  // regardless) or if the live fetch above came back empty.
  if (!preview || preview.status !== "ok") return null;

  let hostname = preview.site_name;
  if (!hostname) {
    try {
      hostname = new URL(preview.url).hostname.replace(/^www\./, "");
    } catch {
      hostname = preview.url;
    }
  }

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-3 flex overflow-hidden rounded-lg border border-border transition-colors hover:bg-muted/50"
    >
      {preview.image_url && (
        // An arbitrary external host a user linked to — next/image's
        // remotePatterns (next.config.ts) is a per-domain allowlist that
        // can't cover every site someone might post, same reasoning as
        // the one existing plain-<img> precedent in
        // components/post-image-picker.tsx.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.image_url}
          alt=""
          referrerPolicy="no-referrer"
          className="h-20 w-20 shrink-0 object-cover sm:h-24 sm:w-28"
        />
      )}
      <div className="min-w-0 flex-1 p-3">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {hostname}
        </p>
        <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-foreground">
          {preview.title}
        </p>
        {preview.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {preview.description}
          </p>
        )}
      </div>
    </a>
  );
}
