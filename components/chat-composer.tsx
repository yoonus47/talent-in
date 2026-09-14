"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Moon, Send, Sun, Users, X } from "lucide-react";
import { VoiceRecorderButton } from "@/components/voice-recorder";
import { useThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import type { GroupMember } from "@/lib/data";

type ReplyPreview = { senderName: string; type: "text" | "voice"; preview: string | null };

type MentionCandidate = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  isEveryone?: boolean;
};

const EVERYONE_CANDIDATE: MentionCandidate = {
  id: "all",
  username: "all",
  full_name: "Everyone",
  avatar_url: null,
  isEveryone: true,
};

// Same cursor-position query regex as components/mention-input.tsx (the
// post-comment mention precedent) — matches "@partial" only when it's
// right behind the cursor, preceded by start-of-string or whitespace.
const MENTION_QUERY_RE = /(?:^|\s)@([a-zA-Z0-9_]{0,24})$/;

/** Static, in-flow dark-mode toggle for the mobile composer row — see
 * ThemeToggle's comment in components/theme-toggle.tsx for why the
 * floating one is hidden here instead of trying to keep it aligned. */
function MobileThemeToggle() {
  const { isDark, toggle } = useThemeToggle();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground hover:bg-muted sm:hidden"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

/**
 * The chat thread's bottom bar — text input, @mention autocomplete (group
 * threads only — `groupMembers` is undefined for a dm, which suppresses
 * all mention UI), a reply-preview strip, the voice recorder, and send.
 * Extracted out of components/chat-thread.tsx (which used to inline this
 * as a ~40-line block) once mentions + reply needed room to live — same
 * "give it its own file" precedent components/mention-input.tsx already
 * set for the comment thread's equivalent composer.
 *
 * `sending` lives here, not in the parent — it only ever needs to disable
 * this bar's own controls, and owning it locally means ChatThread's send
 * handlers don't need to coordinate two states with two different owners.
 */
export function ChatComposer({
  onSend,
  onSendVoice,
  replyingTo,
  onCancelReply,
  groupMembers,
}: {
  onSend: (content: string, mentionedUserIds: string[]) => Promise<void>;
  onSendVoice: (blob: Blob, mimeType: string, durationMs: number) => Promise<void>;
  replyingTo: ReplyPreview | null;
  onCancelReply: () => void;
  /** Group threads only. Already fetched server-side for the thread
   * header (getGroupInfo) — no extra query needed for the mention picker. */
  groupMembers?: GroupMember[];
}) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [recorderActive, setRecorderActive] = useState(false);
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  // username -> id, for whoever was actually picked from the dropdown —
  // same "only ids still present in the final text survive" pattern as
  // mention-input.tsx's handleSubmit, computed again at submit() below.
  const [mentioned, setMentioned] = useState<Map<string, string>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    setValue(text);
    if (!groupMembers) return;

    const cursor = e.target.selectionStart ?? text.length;
    const match = MENTION_QUERY_RE.exec(text.slice(0, cursor));
    if (!match) {
      setCandidates([]);
      return;
    }
    const query = match[1].toLowerCase();
    const everyoneMatches = "all".startsWith(query) || "everyone".startsWith(query);
    const memberMatches = groupMembers
      .filter(
        (m) => m.username.toLowerCase().startsWith(query) || m.full_name.toLowerCase().startsWith(query),
      )
      .slice(0, 6);
    setCandidates([...(everyoneMatches ? [EVERYONE_CANDIDATE] : []), ...memberMatches]);
  }

  function pickCandidate(c: MentionCandidate) {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursor);
    const match = MENTION_QUERY_RE.exec(uptoCursor);
    if (!match) return;

    const atIndex = uptoCursor.lastIndexOf("@");
    const before = value.slice(0, atIndex);
    const after = value.slice(cursor);
    const newValue = `${before}@${c.username} ${after}`;

    // flushSync, not a requestAnimationFrame-deferred focus/selectionRange
    // (mention-input.tsx's own approach for the comment composer) — rAF
    // only fires once the page actually paints a new frame, which a
    // backgrounded/non-visible tab can suspend indefinitely (confirmed
    // live: picking a candidate while the tab wasn't the active/painted
    // one left the textarea unfocused with the cursor never restored).
    // flushSync forces the DOM to reflect the new value synchronously, so
    // focus/selectionRange can be set right after with no dependency on
    // painting at all.
    flushSync(() => {
      setValue(newValue);
      if (!c.isEveryone) setMentioned((prev) => new Map(prev).set(c.username, c.id));
      setCandidates([]);
    });
    const pos = before.length + c.username.length + 2;
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(pos, pos);
  }

  async function submit() {
    const content = value.trim();
    if (!content || sending) return;
    setValue("");
    setCandidates([]);
    setSending(true);

    // @all/@everyone resolves to the full current member list here purely
    // as a send-time convenience — the insert trigger (0026_chat_reply_and
    // _mentions.sql) re-filters mentioned_user_ids down to actual current
    // members minus the sender regardless, so this isn't the security
    // boundary, just what decides what to even try sending.
    const mentionsEveryone = /(?:^|\s)@(all|everyone)\b/i.test(content);
    const ids = mentionsEveryone
      ? (groupMembers ?? []).map((m) => m.id)
      : [...mentioned.entries()].filter(([u]) => content.includes(`@${u}`)).map(([, id]) => id);

    await onSend(content, ids);
    setMentioned(new Map());
    onCancelReply();
    setSending(false);
  }

  async function submitVoice(blob: Blob, mimeType: string, durationMs: number) {
    if (sending) return;
    setSending(true);
    await onSendVoice(blob, mimeType, durationMs);
    onCancelReply();
    setSending(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-border bg-background">
      {replyingTo && (
        <div className="flex items-start gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
            <p className="truncate text-xs font-medium text-primary">Replying to {replyingTo.senderName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {replyingTo.type === "voice" ? "🎤 Voice message" : replyingTo.preview}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* No more pr-16/pb-[27px] collision-avoidance here: ThemeToggle
          hides itself on mobile for this exact route (see its comment),
          so there's no floating button in this corner to clear or align
          with anymore — MobileThemeToggle below is a plain in-flow member
          of this same row instead. */}
      <div className="relative flex items-end gap-2 p-3">
        {candidates.length > 0 && (
          <div className="absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-lg border border-border bg-card shadow-md">
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => pickCandidate(c)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {c.isEveryone ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <Avatar name={c.full_name} src={c.avatar_url} size={24} />
                )}
                <span className="min-w-0 truncate">
                  <span className="font-medium">{c.full_name}</span>{" "}
                  {!c.isEveryone && <span className="text-muted-foreground">@{c.username}</span>}
                </span>
              </button>
            ))}
          </div>
        )}

        {!recorderActive && (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            // text-base (16px), not text-sm — iOS Safari auto-zooms the page
            // in on focus for any text input under 16px, which is the actual
            // cause of the "zooms in when I try to type" behavior. WhatsApp's
            // input (and every other mobile-polished text field) is 16px+
            // for exactly this reason, not because of any deliberate zoom
            // handling.
            className="max-h-32 flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
        {value.trim().length === 0 ? (
          <VoiceRecorderButton onSend={submitVoice} onActiveChange={setRecorderActive} disabled={sending} />
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={value.trim().length === 0 || sending}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
        {!recorderActive && <MobileThemeToggle />}
      </div>
    </div>
  );
}

