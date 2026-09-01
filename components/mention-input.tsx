"use client";

import { useRef, useState, useTransition } from "react";
import { addComment, searchMentionCandidates } from "@/lib/actions/comments";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Candidate = { id: string; username: string; full_name: string; avatar_url: string | null };

/**
 * A comment/reply composer with @mention autocomplete — used for both
 * top-level comments and replies (parentCommentId distinguishes them).
 * Owns its own submission (rather than a plain <form action={...}>) since
 * the mentioned-user-id list is only known once the user has actually
 * picked people from the dropdown, and needs to travel alongside the text
 * to addComment in one call.
 */
export function MentionInput({
  postId,
  recipientId,
  parentCommentId,
  placeholder,
  defaultValue = "",
  submitLabel = "Post",
  autoFocus = false,
  onSubmitted,
}: {
  postId: string;
  recipientId: string;
  parentCommentId: string | null;
  placeholder: string;
  defaultValue?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  onSubmitted?: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [mentioned, setMentioned] = useState<Map<string, string>>(new Map());
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function currentMentionQuery(text: string, cursor: number): string | null {
    const uptoCursor = text.slice(0, cursor);
    const match = /(?:^|\s)@([a-zA-Z0-9_]{1,24})$/.exec(uptoCursor);
    return match ? match[1] : null;
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setValue(text);
    const cursor = e.target.selectionStart ?? text.length;
    const query = currentMentionQuery(text, cursor);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) {
      setCandidates([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchMentionCandidates(query);
      setCandidates(results);
    }, 200);
  }

  function pickCandidate(c: Candidate) {
    const cursor = inputRef.current?.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const match = /(?:^|\s)@([a-zA-Z0-9_]{0,24})$/.exec(uptoCursor);
    if (!match) return;

    const atIndex = uptoCursor.lastIndexOf("@");
    const before = value.slice(0, atIndex);
    const after = value.slice(cursor);
    const newValue = `${before}@${c.username} ${after}`;

    setValue(newValue);
    setMentioned((prev) => new Map(prev).set(c.username, c.id));
    setCandidates([]);

    requestAnimationFrame(() => {
      const pos = before.length + c.username.length + 2;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (value.trim().length === 0 || pending) return;

    const formData = new FormData(e.currentTarget);
    // Only ids whose "@username" is still actually present survive — e.g.
    // if the mention was typed over or deleted after being picked.
    const finalIds = [...mentioned.entries()]
      .filter(([username]) => value.includes(`@${username}`))
      .map(([, id]) => id);

    startTransition(async () => {
      await addComment(postId, recipientId, parentCommentId, finalIds, formData);
      setValue("");
      setMentioned(new Map());
      setCandidates([]);
      onSubmitted?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          name="content"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          maxLength={500}
          autoFocus={autoFocus}
          disabled={pending}
          className="flex h-9 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={pending || value.trim().length === 0}
          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
        >
          {pending ? "…" : submitLabel}
        </button>
      </div>

      {candidates.length > 0 && (
        <div className="absolute left-0 top-full z-10 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-md">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickCandidate(c)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
              )}
            >
              <Avatar name={c.full_name} src={c.avatar_url} size={24} />
              <span className="min-w-0 truncate">
                <span className="font-medium">{c.full_name}</span>{" "}
                <span className="text-muted-foreground">@{c.username}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
