import Link from "next/link";

/** Renders comment/reply text with any "@username" turned into a profile link. */
export function CommentContent({ content }: { content: string }) {
  // A fresh RegExp per call (rather than a shared module-level one reused
  // via its mutable `lastIndex`) — matches the same shape as the username
  // check constraint (3-24 chars, alnum + underscore). Pure presentation-
  // time regex over the stored text; usernames are immutable in this app,
  // so this is always safe without cross-referencing mentioned_user_ids.
  const mentionRe = /@([a-zA-Z0-9_]{3,24})/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = mentionRe.exec(content)) !== null) {
    if (match.index > lastIndex) parts.push(content.slice(lastIndex, match.index));
    const username = match[1];
    parts.push(
      <Link
        key={key++}
        href={`/profile/${username}`}
        className="font-medium text-primary hover:underline"
      >
        @{username}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));

  return <span className="whitespace-pre-wrap">{parts}</span>;
}
