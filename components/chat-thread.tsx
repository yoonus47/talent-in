"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Send, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markConversationRead } from "@/lib/actions/chat";
import { MessageBubble } from "@/components/message-bubble";
import { useThemeToggle } from "@/components/theme-toggle";
import type { Message } from "@/lib/types/database";

type LocalMessage = Message & { pending?: boolean };

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
 * The live chat thread. Unlike every other mutation in this app, sending a
 * message is a direct client-side insert (see lib/actions/chat.ts's header
 * comment) — RLS is the real guard, not a Server Action. A realtime
 * subscription is the single source of truth for anything that isn't the
 * sender's own optimistic echo: new messages, unsends, and the other
 * participant's read-marker (for the "Seen" indicator) all arrive the same
 * way, for both people in the conversation.
 */
export function ChatThread({
  conversationId,
  myId,
  otherUserId,
  initialMessages,
  initialOtherLastReadAt,
}: {
  conversationId: string;
  myId: string;
  otherUserId: string;
  initialMessages: Message[];
  initialOtherLastReadAt: string | null;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [otherLastReadAt, setOtherLastReadAt] = useState(initialOtherLastReadAt);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Merges a confirmed row from the server in, whichever path noticed it
    // first (the sender's own insert response, or this realtime echo) —
    // the other one then just no-ops, since the id is already present.
    function reconcile(newRow: Message) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newRow.id)) return prev;
        const withoutOwnPending = prev.filter(
          (m) => !(m.pending && m.sender_id === newRow.sender_id && m.content === newRow.content),
        );
        return [...withoutOwnPending, newRow].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );
      });
    }

    // The RLS policies on messages/conversation_reads gate postgres_changes
    // the same way they gate a normal select — auth.uid() has to resolve
    // for either to be delivered at all. createClient() here is the
    // @supabase/ssr cookies-based browser client, and its realtime socket
    // doesn't reliably pick up the signed-in session's token on its own;
    // without this explicit setAuth, the subscription reports SUBSCRIBED
    // but silently never receives a single event (confirmed live: a plain
    // supabase-js client with the same RLS received events fine, an
    // @supabase/ssr one without this line did not).
    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);

      channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const newRow = payload.new as Message;
            reconcile(newRow);
            // Keep my own read-marker current while the thread is open, so
            // the sender's "Seen" indicator and my navbar badge both stay
            // accurate without a page reload.
            if (newRow.sender_id !== myId) {
              markConversationRead(conversationId);
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const oldId = (payload.old as { id: string }).id;
            setMessages((prev) => prev.filter((m) => m.id !== oldId));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversation_reads",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as { user_id: string; last_read_at: string };
            if (row.user_id === otherUserId) setOtherLastReadAt(row.last_read_at);
          },
        )
        .subscribe();
    }

    subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, myId, otherUserId]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);

    const optimistic: LocalMessage = {
      id: `temp-${crypto.randomUUID()}`,
      conversation_id: conversationId,
      sender_id: myId,
      content,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: myId, content })
      .select()
      .single();

    setSending(false);

    if (error || !data) {
      console.error("send message failed:", error?.message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      return;
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === data.id)) {
        return prev.filter((m) => m.id !== optimistic.id);
      }
      return prev.map((m) => (m.id === optimistic.id ? data : m));
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const lastMessage = messages[messages.length - 1];
  const showSeen = Boolean(
    lastMessage &&
      !lastMessage.pending &&
      lastMessage.sender_id === myId &&
      otherLastReadAt &&
      otherLastReadAt >= lastMessage.created_at,
  );

  return (
    // A bounded dvh height + an internally-scrolling message list, with the
    // composer as a plain last flex child (not position: sticky) — the
    // standard chat-UI layout, and specifically the one that behaves
    // correctly with iOS Safari's on-screen keyboard: `dvh` (dynamic
    // viewport height) recalculates as the keyboard opens/closes, so a
    // container sized from it — and everything inside it — naturally stays
    // within view without needing sticky/fixed positioning, which is what
    // was actually causing both the "have to pan to reach Send" and the
    // dark-mode visual glitch reported on iPhone (a `position: sticky`
    // element re-anchored against an unbounded, page-scrolling container
    // is exactly the combination WebKit's keyboard-resize handling and
    // sticky repaint both handle poorly).
    <div className="flex h-[calc(100dvh-9.25rem)] flex-col sm:h-[calc(100dvh-7rem)]">
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === myId}
            pending={message.pending}
          />
        ))}
        {showSeen && <p className="pr-1 text-right text-xs text-muted-foreground">Seen</p>}
        <div ref={bottomRef} />
      </div>

      {/* No more pr-16/pb-[27px] collision-avoidance here: ThemeToggle
          hides itself on mobile for this exact route (see its comment),
          so there's no floating button in this corner to clear or align
          with anymore — MobileThemeToggle below is a plain in-flow member
          of this same row instead. */}
      <div className="flex items-end gap-2 border-t border-border bg-background p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
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
        <button
          type="button"
          onClick={handleSend}
          disabled={input.trim().length === 0 || sending}
          aria-label="Send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
        <MobileThemeToggle />
      </div>
    </div>
  );
}
