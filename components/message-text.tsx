import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Renders chat message text with URLs auto-linked and @mentions turned
 * into profile links — @all/@everyone becomes a styled chip instead (it's
 * not a real user). Presentation-time-only, one regex pass, same "trust
 * the text shape, don't cross-reference ids" precedent as
 * components/comment-content.tsx: usernames are immutable, and this
 * doesn't check `mentioned_user_ids` before linkifying, so a message
 * containing "@someone" who was never actually picked from the mention
 * dropdown still renders as a normal (harmless, just-a-link) mention —
 * exactly like CommentContent already does for post comments.
 *
 * The @(all|everyone)\b word boundary matters: without it "@allison"
 * would partial-match "@all" and render as the Everyone chip instead of a
 * profile link. With it, "l" (from "@all") followed by "i" (from
 * "allison") are both word characters, \b fails to match between them, so
 * the engine falls through to the generic @username alternative instead.
 */
const TOKEN_SOURCE =
  /(https?:\/\/[^\s<]+[^\s<.,!?:;'")\]])|@(all|everyone)\b|@([a-zA-Z0-9_]{3,24})/;

export function MessageText({
  content,
  tone,
}: {
  content: string;
  /** "own" bubbles are bg-primary — a same-hue link there would be
   * invisible, so it gets an underline instead of a color change; "other"
   * matches CommentContent's text-primary treatment. */
  tone: "own" | "other";
}) {
  // A fresh RegExp per call, not a shared module-level one reused via its
  // mutable `lastIndex` — same precedent as components/comment-content.tsx.
  const tokenRe = new RegExp(TOKEN_SOURCE, "gi");
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tokenRe.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
    const [full, url, everyone, username] = match;

    if (url) {
      parts.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "break-all",
            tone === "own" ? "underline underline-offset-2" : "font-medium text-primary hover:underline",
          )}
        >
          {url}
        </a>,
      );
    } else if (everyone) {
      parts.push(
        <span
          key={key++}
          className={cn(
            "rounded px-1 py-0.5 font-medium",
            tone === "own" ? "bg-primary-foreground/20" : "bg-primary/15 text-primary",
          )}
        >
          @{everyone}
        </span>,
      );
    } else if (username) {
      parts.push(
        <Link
          key={key++}
          href={`/profile/${username}`}
          className={cn(
            tone === "own" ? "underline underline-offset-2" : "font-medium text-primary hover:underline",
          )}
        >
          @{username}
        </Link>,
      );
    } else {
      parts.push(full);
    }

    lastIndex = match.index + full.length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));

  return <p className="whitespace-pre-wrap break-words">{parts}</p>;
}
