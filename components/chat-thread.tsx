"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { markConversationRead } from "@/lib/actions/chat";
import { MessageBubble } from "@/components/message-bubble";
import { MessageInfoPanel } from "@/components/message-info-panel";
import { ChatComposer } from "@/components/chat-composer";
import { audioExtensionFor } from "@/lib/audio-client";
import type { Message } from "@/lib/types/database";
import type { GroupMember } from "@/lib/data";

type LocalMessage = Message & {
  pending?: boolean;
  /** Voice only — a client-generated id embedded in the Storage filename
   * *before* upload starts (see handleSendVoice), so a pending placeholder
   * can be matched to its eventual real row even though the placeholder
   * plays from a local blob URL, never the real audio_url. */
  clientId?: string;
};
type SenderProfile = { full_name: string; avatar_url: string | null };

/** What's being replied to, kept in ChatThread (a sibling of both the
 * message list and the composer) rather than in ChatComposer itself —
 * it's set from a message row, not from anything the composer owns. Built
 * entirely from data already in memory (no query): the target message's
 * own fields plus its sender's display name, resolved once here via
 * senderDisplayName so both the compose-time strip and (eventually) any
 * other consumer agree on the same "You"/name logic. */
type ReplyingTo = {
  id: string;
  senderId: string;
  senderName: string;
  type: "text" | "voice";
  content: string | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** UTC-based day key/label, deliberately NOT toLocaleDateString — its
 * output depends on the runtime's locale/timezone, which differs between
 * this component's server render and the browser's hydration (the exact
 * hydration-mismatch class MessageBubble's timeAgo comment documents).
 * `created_at` is a UTC ISO timestamp, so slicing/reading it in UTC gives
 * the same string on both sides no matter where either runs. */
function dayKey(iso: string) {
  return iso.slice(0, 10);
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Consecutive messages from the same sender, less than 5 minutes apart,
 * on the same calendar day, render as one visually grouped run (tail
 * corner + sender name only on/above the boundary bubbles). */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

type RenderItem =
  | { kind: "separator"; key: string; label: string }
  | {
      kind: "message";
      message: LocalMessage;
      isLastInRun: boolean;
      senderName?: string;
      /** Group, non-own messages only, and only on the *last* bubble of a
       * run (the one with the tail corner) — the name label above uses
       * the *first* bubble instead, matching Telegram/iMessage's own
       * convention for a consecutive run: name at the top, avatar at the
       * bottom, both naturally coinciding for the (most common)
       * single-bubble case. `null` (not just absent) means "group,
       * non-own, right run position, but this sender has no avatar" —
       * MessageBubble still needs to render the initials fallback then,
       * which `undefined` (no avatar column at all) would suppress. */
      senderAvatarUrl?: string | null;
    };

function buildRenderItems(
  messages: LocalMessage[],
  myId: string,
  conversationType: "dm" | "group",
  memberProfiles: Record<string, SenderProfile>,
): RenderItem[] {
  const items: RenderItem[] = [];
  let lastDayKey: string | null = null;

  messages.forEach((message, i) => {
    const key = dayKey(message.created_at);
    if (key !== lastDayKey) {
      items.push({ kind: "separator", key, label: dayLabel(message.created_at) });
      lastDayKey = key;
    }

    const next = messages[i + 1];
    const sameDayNext = next && dayKey(next.created_at) === key;
    const isLastInRun =
      !sameDayNext ||
      next.sender_id !== message.sender_id ||
      new Date(next.created_at).getTime() - new Date(message.created_at).getTime() > GROUP_WINDOW_MS;

    const prev = messages[i - 1];
    const samePrevRun =
      prev &&
      dayKey(prev.created_at) === key &&
      prev.sender_id === message.sender_id &&
      new Date(message.created_at).getTime() - new Date(prev.created_at).getTime() <= GROUP_WINDOW_MS;

    const isFirstInRun = !samePrevRun;
    const isGroupOther = conversationType === "group" && message.sender_id !== myId;
    const senderName =
      isGroupOther && isFirstInRun ? memberProfiles[message.sender_id]?.full_name : undefined;
    const senderAvatarUrl =
      isGroupOther && isLastInRun ? (memberProfiles[message.sender_id]?.avatar_url ?? null) : undefined;

    items.push({ kind: "message", message, isLastInRun, senderName, senderAvatarUrl });
  });

  return items;
}

/**
 * The live chat thread — dm or group alike. Unlike every other mutation in
 * this app, sending a message is a direct client-side insert (see
 * lib/actions/chat.ts's header comment) — RLS is the real guard, not a
 * Server Action. A realtime subscription is the single source of truth for
 * anything that isn't the sender's own optimistic echo: new messages,
 * unsends, and (dm only) the other participant's read-marker all arrive
 * the same way. RLS already scopes delivery to conversations this user is
 * a member of (conversation_members, 0019_group_chats.sql), so this
 * subscription needs no dm/group branching of its own.
 */
export function ChatThread({
  conversationId,
  myId,
  conversationType,
  otherUserId,
  otherUserName,
  memberProfiles = {},
  groupMembers,
  initialMessages,
  initialReadReceipts = {},
  initialDeliveryReceipts = {},
}: {
  conversationId: string;
  myId: string;
  conversationType: "dm" | "group";
  /** dm only — the other participant, for the read-receipt check. */
  otherUserId?: string;
  /** dm only — used to resolve the reply-quote/reply-strip's sender label;
   * no extra query, already fetched by app/chat/[id]/page.tsx. */
  otherUserName?: string;
  /** group only — id → profile, for sender-name attribution. Built from
   * actual message senders (lib/data.ts's getMessageSenderProfiles), not
   * current membership, so a departed member's old messages still show a
   * name. */
  memberProfiles?: Record<string, SenderProfile>;
  /** group only — the FULL current member list (unlike memberProfiles
   * above), for the @mention autocomplete in ChatComposer AND (unfiltered)
   * for computing each own message's read status below. From
   * getGroupInfo, already fetched for the thread header. */
  groupMembers?: GroupMember[];
  initialMessages: Message[];
  /** Every member's read-marker (user_id -> last_read_at), dm and group
   * alike — see lib/data.ts's getConversationReadReceipts. Powers the
   * WhatsApp-style per-message check/checkmark in message-bubble.tsx. */
  initialReadReceipts?: Record<string, string>;
  /** Same shape, for the delivery watermark — see lib/data.ts's
   * getConversationDeliveryReceipts. */
  initialDeliveryReceipts?: Record<string, string>;
}) {
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [readReceipts, setReadReceipts] = useState(initialReadReceipts);
  const [deliveryReceipts, setDeliveryReceipts] = useState(initialDeliveryReceipts);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [infoMessage, setInfoMessage] = useState<LocalMessage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Whoever ELSE needs to have read a message for it to count as "read" —
  // a dm's one other participant, or every other current group member.
  // Computed once per render, not per-message: message status just
  // compares each own message's created_at against this same fixed list.
  const otherMemberIds =
    conversationType === "group"
      ? (groupMembers ?? []).filter((m) => m.id !== myId).map((m) => m.id)
      : otherUserId
        ? [otherUserId]
        : [];

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
    // Matching a pending optimistic echo to its confirmed row can't use
    // `content` for voice messages (always null on both sides) — two voice
    // notes sent close together would both match the first confirmed row
    // that arrives ("Hi" === "Hi" is fine because content is unique-ish;
    // null === null isn't). Voice instead matches via `clientId`, a
    // client-generated id embedded in the Storage filename *before*
    // upload — see handleSendVoice — so it's a substring of the real
    // audio_url regardless of when the upload actually finishes.
    function reconcile(newRow: Message) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newRow.id)) return prev;
        const withoutOwnPending = prev.filter((m) => {
          if (!m.pending || m.sender_id !== newRow.sender_id || m.type !== newRow.type) return true;
          const matches =
            newRow.type === "voice"
              ? Boolean(m.clientId && newRow.audio_url?.includes(m.clientId))
              : m.content === newRow.content;
          return !matches;
        });
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
            setReadReceipts((prev) => ({ ...prev, [row.user_id]: row.last_read_at }));
          },
        )
        // markConversationRead upserts: the *first* time a given member
        // ever reads this conversation, that's a plain INSERT (no
        // existing row for them yet), not an UPDATE — the same gap
        // components/chat-fab-button.tsx's own comment documents for the
        // unread badge. Missing this meant a group/dm partner's checkmark
        // never went blue live on their very first read, only after a
        // reload (which re-fetches getConversationReadReceipts fresh).
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "conversation_reads",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as { user_id: string; last_read_at: string };
            setReadReceipts((prev) => ({ ...prev, [row.user_id]: row.last_read_at }));
          },
        )
        // Same pair (UPDATE + INSERT, same first-ever-write gap) as
        // conversation_reads just above, for the delivery watermark.
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "conversation_deliveries",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as { user_id: string; last_delivered_at: string };
            setDeliveryReceipts((prev) => ({ ...prev, [row.user_id]: row.last_delivered_at }));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "conversation_deliveries",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as { user_id: string; last_delivered_at: string };
            setDeliveryReceipts((prev) => ({ ...prev, [row.user_id]: row.last_delivered_at }));
          },
        )
        .subscribe();
    }

    subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, myId]);

  /** "You" for the current viewer, the group sender's attributed name, or
   * the dm partner's name — shared by both the pre-send reply strip and
   * (indirectly, via the stored snapshot) the persisted quote block, so
   * they never disagree. */
  function senderDisplayName(senderId: string): string {
    if (senderId === myId) return "You";
    if (conversationType === "group") return memberProfiles[senderId]?.full_name ?? "Someone";
    return otherUserName ?? "Someone";
  }

  function replySnapshotFields(reply: ReplyingTo | null) {
    return {
      reply_to_id: reply?.id ?? null,
      reply_to_sender_id: reply?.senderId ?? null,
      reply_to_sender_name: reply?.senderName ?? null,
      reply_to_type: reply?.type ?? null,
      reply_to_preview: reply && reply.type === "text" ? (reply.content ?? "").slice(0, 120) : null,
    };
  }

  /**
   * Sends a text message, optionally as a reply and/or with @mentions
   * (mentionedUserIds are the composer's own best-effort picks — the
   * insert trigger, 0026_chat_reply_and_mentions.sql, is what actually
   * sanitizes them down to real current members, so the batched
   * notification insert below reads the *returned* row's ids, not these).
   * The full reply_to_* snapshot is built here too, client-side, purely so
   * the optimistic echo shows its quote block immediately — the real
   * insert only sends reply_to_id; the trigger fills the rest server-side,
   * and the reconciled real row (whichever path notices it first) is what
   * actually persists.
   */
  async function handleSend(content: string, mentionedUserIds: string[]) {
    if (!content) return;

    const optimistic: LocalMessage = {
      id: `temp-${crypto.randomUUID()}`,
      conversation_id: conversationId,
      sender_id: myId,
      type: "text",
      content,
      audio_url: null,
      duration_ms: null,
      mentioned_user_ids: mentionedUserIds,
      created_at: new Date().toISOString(),
      pending: true,
      ...replySnapshotFields(replyingTo),
    };
    setMessages((prev) => [...prev, optimistic]);
    const replyToId = replyingTo?.id ?? null;
    setReplyingTo(null);

    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: myId,
        type: "text",
        content,
        reply_to_id: replyToId,
        mentioned_user_ids: mentionedUserIds,
      })
      .select()
      .single();

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

    // Trigger-sanitized recipients only — never the pre-send guess above,
    // which could include a stale/tampered client's picks (see the
    // migration's header comment for why that filtering has to happen
    // server-side, not here).
    if (conversationType === "group" && data.mentioned_user_ids.length > 0) {
      const rows = data.mentioned_user_ids.map((userId) => ({
        user_id: userId,
        actor_id: myId,
        type: "mention" as const,
        conversation_id: conversationId,
      }));
      const { error: notifyError } = await supabase.from("notifications").insert(rows);
      if (notifyError) console.error("mention notification insert failed:", notifyError.message);
    }
  }

  /**
   * Sends a recorded voice note: uploads the blob straight to Storage from
   * the browser (RLS-gated, no server round-trip — same "direct client
   * mutation" exception documented at the top of this file for text), then
   * inserts the messages row the same way text does. The optimistic
   * placeholder plays instantly from the in-memory blob's own object URL
   * while the real upload happens in the background. Voice messages never
   * carry @mentions (only the text composer offers the autocomplete), but
   * can still be sent as a reply, same as text.
   */
  async function handleSendVoice(blob: Blob, mimeType: string, durationMs: number) {
    const clientId = crypto.randomUUID();
    const ext = audioExtensionFor(mimeType);
    const path = `${conversationId}/${myId}/${clientId}.${ext}`;
    const localUrl = URL.createObjectURL(blob);

    const optimistic: LocalMessage = {
      id: `temp-${clientId}`,
      conversation_id: conversationId,
      sender_id: myId,
      type: "voice",
      content: null,
      audio_url: localUrl,
      duration_ms: durationMs,
      mentioned_user_ids: [],
      created_at: new Date().toISOString(),
      pending: true,
      clientId,
      ...replySnapshotFields(replyingTo),
    };
    setMessages((prev) => [...prev, optimistic]);
    const replyToId = replyingTo?.id ?? null;
    setReplyingTo(null);

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("voice-messages")
      .upload(path, blob, { contentType: mimeType });

    if (uploadError) {
      console.error("voice upload failed:", uploadError.message);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      URL.revokeObjectURL(localUrl);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("voice-messages").getPublicUrl(path);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: myId,
        type: "voice",
        audio_url: publicUrl,
        duration_ms: durationMs,
        reply_to_id: replyToId,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("send voice message failed:", error?.message);
      // The file uploaded but the row never landed — clean it up so it
      // doesn't sit there forever as an orphan.
      await supabase.storage.from("voice-messages").remove([path]);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      URL.revokeObjectURL(localUrl);
      return;
    }

    setMessages((prev) => {
      if (prev.some((m) => m.id === data.id)) {
        return prev.filter((m) => m.id !== optimistic.id);
      }
      return prev.map((m) => (m.id === optimistic.id ? data : m));
    });
    URL.revokeObjectURL(localUrl);
  }

  function wasReadBy(id: string, message: LocalMessage): boolean {
    const lastRead = readReceipts[id];
    return Boolean(lastRead) && lastRead >= message.created_at;
  }

  // Reading implies receiving — a member whose read watermark covers this
  // message counts as delivered-to even if their delivery watermark
  // somehow lags behind (shouldn't normally happen, but the two are
  // written independently, by different call sites, so this keeps the
  // ladder internally consistent regardless).
  function wasDeliveredTo(id: string, message: LocalMessage): boolean {
    const lastDelivered = deliveryReceipts[id];
    return (Boolean(lastDelivered) && lastDelivered >= message.created_at) || wasReadBy(id, message);
  }

  /** WhatsApp-style per-message status for one of MY OWN messages — a real
   * 4-state ladder, not just sent-vs-read:
   * "pending" (still an optimistic local echo) -> "sent" (confirmed, not
   * yet delivered to everyone relevant) -> "delivered" (every other
   * relevant participant's device has it, per conversation_deliveries) ->
   * "read" (every one of them has actually opened the thread past it).
   * "Relevant" is the dm's one other person, or — for a group — *every*
   * other current member, matching WhatsApp's own group aggregate (the
   * simple checkmark reflects the slowest member; components/message-
   * info-panel.tsx is where you see who specifically). Both watermarks,
   * not per-message receipts — an old message silently "becomes"
   * delivered/read the moment a marker passes it, no event needed per
   * message; see supabase/migrations/0029_delivery_receipts.sql. */
  function messageStatus(message: LocalMessage): "pending" | "sent" | "delivered" | "read" {
    if (message.pending) return "pending";
    if (otherMemberIds.length === 0) return "sent";
    if (otherMemberIds.every((id) => wasReadBy(id, message))) return "read";
    if (otherMemberIds.every((id) => wasDeliveredTo(id, message))) return "delivered";
    return "sent";
  }

  const renderItems = buildRenderItems(messages, myId, conversationType, memberProfiles);

  // Read-by / delivered-to breakdown for whichever message's "Message
  // info" was tapped (group only, see onShowInfo above) — computed from
  // data already in memory, no extra query. A member appears in exactly
  // one list: read-by takes precedence (reading implies receiving), so
  // deliveredTo here only ever holds "received it, hasn't read it yet."
  // Members satisfying neither simply aren't in either list, same as
  // WhatsApp's own info screen not listing who hasn't gotten it yet.
  const infoLists = infoMessage
    ? (() => {
        const others = (groupMembers ?? []).filter((m) => m.id !== myId);
        return {
          readBy: others
            .filter((m) => wasReadBy(m.id, infoMessage))
            .map((m) => ({ ...m, at: readReceipts[m.id] })),
          deliveredTo: others
            .filter((m) => !wasReadBy(m.id, infoMessage) && wasDeliveredTo(m.id, infoMessage))
            .map((m) => ({ ...m, at: deliveryReceipts[m.id] ?? readReceipts[m.id] })),
        };
      })()
    : null;

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
      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <MessageCircle className="h-8 w-8 opacity-40" />
            <p className="text-sm">No messages yet — say hi 👋</p>
          </div>
        ) : (
          renderItems.map((item) =>
            item.kind === "separator" ? (
              <div key={item.key} className="flex justify-center py-2">
                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ) : (
              <div key={item.message.id} className={item.isLastInRun ? "pb-1.5" : ""}>
                <MessageBubble
                  message={item.message}
                  myId={myId}
                  isOwn={item.message.sender_id === myId}
                  pending={item.message.pending}
                  isLastInRun={item.isLastInRun}
                  senderName={item.senderName}
                  senderAvatarUrl={item.senderAvatarUrl}
                  status={item.message.sender_id === myId ? messageStatus(item.message) : undefined}
                  onReply={(message) =>
                    setReplyingTo({
                      id: message.id,
                      senderId: message.sender_id,
                      senderName: senderDisplayName(message.sender_id),
                      type: message.type,
                      content: message.content,
                    })
                  }
                  // Group only — a dm's one other participant makes a
                  // breakdown redundant, the checkmark already says it
                  // all (see messageStatus's own comment).
                  onShowInfo={conversationType === "group" ? () => setInfoMessage(item.message) : undefined}
                />
              </div>
            ),
          )
        )}
        <div ref={bottomRef} />
      </div>

      <ChatComposer
        onSend={handleSend}
        onSendVoice={handleSendVoice}
        replyingTo={
          replyingTo && {
            senderName: replyingTo.senderName,
            type: replyingTo.type,
            preview: replyingTo.type === "voice" ? null : replyingTo.content,
          }
        }
        onCancelReply={() => setReplyingTo(null)}
        // Excludes myself — the picker is for tagging someone ELSE; the
        // insert trigger would silently drop a self-mention anyway (it
        // filters mentioned_user_ids to exclude the sender), but leaving
        // yourself in the dropdown would look like a working option when
        // picking it does nothing observable.
        groupMembers={
          conversationType === "group" ? groupMembers?.filter((m) => m.id !== myId) : undefined
        }
      />

      {infoMessage && infoLists && (
        <MessageInfoPanel
          readBy={infoLists.readBy}
          deliveredTo={infoLists.deliveredTo}
          onClose={() => setInfoMessage(null)}
        />
      )}
    </div>
  );
}
