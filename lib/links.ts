/**
 * Shared URL-detection rules — used both to linkify a post's text
 * (components/post-content.tsx) and to decide what URL a link-preview
 * card is for (lib/data.ts, components/post-card.tsx). Both call sites
 * need to agree on exactly what counts as a URL and where it ends; kept
 * in one place so they can't silently drift apart.
 */

// Twitter-style: any http(s):// or www.-prefixed run of non-whitespace.
export const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

/**
 * Trailing punctuation (a period ending the sentence, a comma, a closing
 * quote…) shouldn't be swallowed into the link — "check this out
 * https://example.com." should link just the URL, not the trailing dot.
 * The one case that needs care: a URL can legitimately end in `)` (e.g. a
 * Wikipedia link with a disambiguator), so a trailing `)` is only trimmed
 * when it isn't balancing an earlier `(` inside the same URL.
 */
export function splitTrailingPunctuation(url: string): { url: string; trailing: string } {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if (".,;:!?'\"".includes(ch)) {
      end--;
      continue;
    }
    if (ch === ")") {
      const opens = (url.slice(0, end - 1).match(/\(/g) ?? []).length;
      const closes = (url.slice(0, end - 1).match(/\)/g) ?? []).length;
      if (closes >= opens) {
        end--;
        continue;
      }
    }
    break;
  }
  return { url: url.slice(0, end), trailing: url.slice(end) };
}

/**
 * The first URL in a block of post text, cleaned up the same way
 * PostContent cleans each match (trailing punctuation stripped, a bare
 * "www." prefix given an "https://" scheme) — or null if there isn't one.
 * Plain TS, no "use client": both a Server Component (PostCard) and
 * lib/data.ts (server-only) import this directly.
 */
export function extractFirstUrl(content: string): string | null {
  const match = new RegExp(URL_RE).exec(content);
  if (!match) return null;
  const { url } = splitTrailingPunctuation(match[0]);
  if (!url) return null; // the whole "match" was punctuation
  return url.startsWith("http") ? url : `https://${url}`;
}
