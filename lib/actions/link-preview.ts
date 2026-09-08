"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchLinkMetadata } from "@/lib/link-preview-fetch";
import type { LinkPreview } from "@/lib/types/database";

// A cached row older than this gets re-fetched on next view rather than
// trusted forever — link metadata rarely changes, but "never" is wrong
// too (a site can rename a page, swap its thumbnail, etc.).
const FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The client-triggered path (components/link-preview-card.tsx), reached
 * only when lib/data.ts's server-side batch read didn't already have a
 * fresh cache entry for this URL — i.e. only for a link genuinely nobody
 * has viewed on this platform in the last week. Everything else is a
 * cache hit that never reaches this function at all.
 */
export async function getLinkPreview(url: string): Promise<LinkPreview | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // an authenticated-only affordance, like everything else here

  const { data: cached } = await supabase
    .from("link_previews")
    .select("*")
    .eq("url", url)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < FRESHNESS_MS) {
    return cached.status === "ok" ? cached : null;
  }

  const fetched = await fetchLinkMetadata(url);

  const { data: saved } = await supabase
    .from("link_previews")
    .upsert(
      {
        url,
        status: fetched ? "ok" : "failed",
        title: fetched?.title ?? null,
        description: fetched?.description ?? null,
        image_url: fetched?.imageUrl ?? null,
        site_name: fetched?.siteName ?? null,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "url" },
    )
    .select("*")
    .maybeSingle();

  return fetched && saved ? saved : null;
}
