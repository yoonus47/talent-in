"use client";

// PostCard (which renders this) is a Server Component — the onClick below
// (stopping the click from also reaching DoubleTapReact's tap-to-react
// handling) is a plain event handler, which can only live in a Client
// Component. Confirmed live: without this directive, Next refuses to
// render it at all ("Event handlers cannot be passed to Client Component
// props"). components/comment-content.tsx doesn't need this — it only
// renders <Link>, no onClick of its own.
//
// Matches components/comment-content.tsx's shape (a regex pass over the
// stored text at render time, no editing of the stored content itself),
// but for URLs instead of @mentions — Twitter-style: any http(s):// or
// www.-prefixed run of non-whitespace becomes a real clickable link.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

/**
 * Trailing punctuation (a period ending the sentence, a comma, a closing
 * quote…) shouldn't be swallowed into the link — "check this out
 * https://example.com." should link just the URL, not the trailing dot.
 * The one case that needs care: a URL can legitimately end in `)` (e.g. a
 * Wikipedia link with a disambiguator), so a trailing `)` is only trimmed
 * when it isn't balancing an earlier `(` inside the same URL.
 */
function splitTrailingPunctuation(url: string): { url: string; trailing: string } {
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

/** Renders post text with any URL turned into a real, clickable link
 * (opens in a new tab) — same presentation-time-regex approach as
 * CommentContent, just for links instead of @mentions. */
export function PostContent({ content }: { content: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  const re = new RegExp(URL_RE);

  while ((match = re.exec(content)) !== null) {
    const { url, trailing } = splitTrailingPunctuation(match[0]);
    if (!url) continue; // the whole "match" was punctuation — nothing to link

    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));

    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a
        key={key++}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="break-all text-primary hover:underline"
      >
        {url}
      </a>,
    );
    if (trailing) parts.push(trailing);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));

  return <span className="whitespace-pre-wrap">{parts}</span>;
}
