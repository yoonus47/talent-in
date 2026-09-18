"use client";

import { useRef, useState, useTransition } from "react";
import { createCommunityReply } from "@/lib/actions/community";
import { searchMentionCandidates } from "@/lib/actions/comments";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Candidate = { id: string; username: string; full_name: string; avatar_url: string | null };

// Same query shape as components/mention-input.tsx's own regex — matches
// "@partial" only when it's right behind the cursor, preceded by
// start-of-string or whitespace.
const MENTION_QUERY_RE = /(?:^|\s)@([a-zA-Z0-9_]{0,24})$/;

/**
 * Reply box at the bottom of a thread — a textarea (replies run up to
 * 1000 chars, vs. mention-input.tsx's single-line comment field) with its
 * own @mention autocomplete, rather than sharing components/mention-
 * input.tsx directly: same reasoning components/chat-composer.tsx already
 * used to keep its own mention logic separate instead of reusing that
 * component. `searchMentionCandidates` (lib/actions/comments.ts) is
 * already generic — "anyone on the platform" — so it's reused as-is, no
 * community-specific version needed.
 */
export function CommunityReplyComposer({
  threadId,
  recipientId,
}: {
  threadId: string;
  /** The thread author — who gets the "replied to your thread"
   * notification (createCommunityReply, lib/actions/community.ts). */
  recipientId: string;
}) {
  const [value, setValue] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  // username -> id, for whoever was actually picked from the dropdown —
  // same "only ids whose @username survived to submit-time count" pattern
  // as mention-input.tsx's handleSubmit.
  const [mentioned, setMentioned] = useState<Map<string, string>>(new Map());
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setValue(text);

    const cursor = e.target.selectionStart ?? text.length;
    const match = MENTION_QUERY_RE.exec(text.slice(0, cursor));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!match) {
      setCandidates([]);
      return;
    }
    const query = match[1];
    debounceRef.current = setTimeout(async () => {
      const results = await searchMentionCandidates(query);
      setCandidates(results);
    }, 200);
  }

  function pickCandidate(c: Candidate) {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const match = MENTION_QUERY_RE.exec(uptoCursor);
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
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(pos, pos);
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (value.trim().length === 0 || isPending) return;

    const formData = new FormData(e.currentTarget);
    const finalIds = [...mentioned.entries()]
      .filter(([username]) => value.includes(`@${username}`))
      .map(([, id]) => id);

    startTransition(async () => {
      await createCommunityReply(threadId, recipientId, finalIds, formData);
      setValue("");
      setMentioned(new Map());
      setCandidates([]);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
      <textarea
        ref={textareaRef}
        name="content"
        value={value}
        onChange={handleChange}
        placeholder="Add a reply…"
        rows={2}
        maxLength={1000}
        disabled={isPending}
        className="flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isPending || value.trim().length === 0}
        className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        {isPending ? "…" : "Reply"}
      </button>

      {candidates.length > 0 && (
        <div className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-md">
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickCandidate(c)}
              className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted")}
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
