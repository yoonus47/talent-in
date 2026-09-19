"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCommunityReply } from "@/lib/actions/community";
import { searchMentionCandidates } from "@/lib/actions/comments";
import { PostImagePicker } from "@/components/post-image-picker";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Candidate = { id: string; username: string; full_name: string; avatar_url: string | null };

// Same query shape as components/mention-input.tsx's own regex — matches
// "@partial" only when it's right behind the cursor, preceded by
// start-of-string or whitespace.
const MENTION_QUERY_RE = /(?:^|\s)@([a-zA-Z0-9_]{0,24})$/;

/** The textarea + submit button — split out from CommunityReplyComposer
 * itself so it can call useFormStatus() (which only ever sees the
 * nearest *ancestor* form, so the component rendering the <form> tag
 * can't also read its own pending state — same reason components/
 * submit-button.tsx exists as its own component one level down). */
function ReplyFields({
  value,
  onChange,
  placeholder,
  textareaRef,
  autoFocus,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  autoFocus: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={textareaRef}
        name="content"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={2}
        maxLength={1000}
        autoFocus={autoFocus}
        disabled={pending}
        className="flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={pending || value.trim().length === 0}
        className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        {pending ? "…" : "Reply"}
      </button>
    </div>
  );
}

/**
 * Reply box — a textarea (replies run up to 1000 chars, vs. mention-
 * input.tsx's single-line comment field) with its own @mention
 * autocomplete, rather than sharing components/mention-input.tsx
 * directly: same reasoning components/chat-composer.tsx already used to
 * keep its own mention logic separate instead of reusing that component.
 * `searchMentionCandidates` (lib/actions/comments.ts) is already generic
 * — "anyone on the platform" — so it's reused as-is, no community-
 * specific version needed.
 *
 * Submits via `action={submitReply}` (a plain client-side async
 * function, not a "use server" action) rather than onSubmit+
 * preventDefault — needed so PostImagePicker's own useFormStatus-driven
 * "clear my preview once the form finishes submitting" effect actually
 * fires. React's form-action machinery tracks pending status for *any*
 * function passed as `action`, server or not; a manual onSubmit handler
 * never sets that pending state at all, which used to mean a picked
 * image would stay visibly "attached" after the reply had already
 * posted (this composer doesn't redirect away like NewThreadForm does,
 * so there's no unmount to hide that).
 *
 * Used two ways: as the thread's main "Add a reply" box (no `parentReply`,
 * posts top-level), and inline under one specific top-level reply
 * (components/community-reply-row.tsx, `parentReply` set) — seeded with
 * an @mention of who you're replying to, one level of real nesting plus
 * a mention so it still *reads* like a continued thread past that cap,
 * per the user's own framing when this was scoped.
 */
export function CommunityReplyComposer({
  threadId,
  parentReply,
  autoFocus = false,
  onSubmitted,
}: {
  threadId: string;
  /** Set only for the inline "reply to this reply" case — seeds the
   * textarea with "@username " and pre-registers that mention so it
   * still counts even if the text is never touched again. */
  parentReply?: { id: string; username: string } | null;
  autoFocus?: boolean;
  onSubmitted?: () => void;
}) {
  const initialValue = parentReply ? `@${parentReply.username} ` : "";
  const [value, setValue] = useState(initialValue);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  // username -> id, for whoever was actually picked from the dropdown —
  // same "only ids whose @username survived to submit-time count" pattern
  // as mention-input.tsx's handleSubmit. Seeded with the reply-target's
  // own mention so it survives to submit-time without the user having to
  // re-pick it from the dropdown themselves.
  const [mentioned, setMentioned] = useState<Map<string, string>>(
    () => new Map(parentReply ? [[parentReply.username, parentReply.id]] : []),
  );
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

  async function submitReply(formData: FormData) {
    if (value.trim().length === 0) return;
    const finalIds = [...mentioned.entries()]
      .filter(([username]) => value.includes(`@${username}`))
      .map(([, id]) => id);

    await createCommunityReply(threadId, finalIds, parentReply?.id ?? null, formData);
    setValue("");
    setMentioned(new Map());
    setCandidates([]);
    onSubmitted?.();
  }

  return (
    <form action={submitReply} className="relative space-y-2">
      <ReplyFields
        value={value}
        onChange={handleChange}
        placeholder={parentReply ? `Reply to @${parentReply.username}…` : "Add a reply…"}
        textareaRef={textareaRef}
        autoFocus={autoFocus}
      />

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

      {/* Already fully generic (a plain name="image" file input + hidden
          imageWidth/imageHeight fields) — same component NewThreadForm
          uses for a thread's own image, inherits the same HEIC-conversion/
          dimension-capture/validation for free. */}
      <PostImagePicker />
    </form>
  );
}
