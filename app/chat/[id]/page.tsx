import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import {
  getConversation,
  getConversationDeliveryReceipts,
  getConversationReadReceipts,
  getCurrentProfile,
  getGroupInfo,
  getMessages,
  getMessageSenderProfiles,
  getOtherParticipant,
} from "@/lib/data";
import { markConversationDelivered, markConversationRead } from "@/lib/actions/chat";
import { ChatThread } from "@/components/chat-thread";
import { BackLink } from "@/components/back-link";
import { TransitionLink } from "@/components/transition-link";
import { Avatar } from "@/components/ui/avatar";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/onboarding");

  // getConversation only returns a row if `viewer` is actually a member —
  // RLS (conversation_members, 0019_group_chats.sql) is the real guard;
  // this just turns "not a member" into a 404 instead of an empty page.
  const conversation = await getConversation(id);
  if (!conversation) notFound();

  if (conversation.type === "group") {
    const groupInfo = await getGroupInfo(conversation.id);
    if (!groupInfo) notFound();

    const messages = await getMessages(conversation.id);
    const [senderProfiles, readReceipts, deliveryReceipts] = await Promise.all([
      getMessageSenderProfiles(messages),
      getConversationReadReceipts(conversation.id),
      getConversationDeliveryReceipts(conversation.id),
    ]);

    // Clears the unread badge the instant the thread is opened, and
    // catches up delivery for a direct deep link that skipped /chat's own
    // catch-up (app/chat/page.tsx).
    await Promise.all([markConversationRead(conversation.id), markConversationDelivered(conversation.id)]);

    return (
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <BackLink fallbackHref="/chat" aria-label="Back to messages">
            <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </BackLink>
          <TransitionLink
            href={`/chat/${conversation.id}/info`}
            direction="forward"
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <Avatar name={groupInfo.name} src={groupInfo.iconUrl} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {groupInfo.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {groupInfo.members.length} member{groupInfo.members.length === 1 ? "" : "s"}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </TransitionLink>
        </div>

        <ChatThread
          conversationId={conversation.id}
          myId={viewer.id}
          conversationType="group"
          memberProfiles={Object.fromEntries(senderProfiles)}
          groupMembers={groupInfo.members}
          initialMessages={messages}
          initialReadReceipts={readReceipts}
          initialDeliveryReceipts={deliveryReceipts}
        />
      </div>
    );
  }

  const otherUser = await getOtherParticipant(conversation, viewer.id);
  if (!otherUser) notFound();

  const [messages, readReceipts, deliveryReceipts] = await Promise.all([
    getMessages(conversation.id),
    getConversationReadReceipts(conversation.id),
    getConversationDeliveryReceipts(conversation.id),
  ]);

  // Clears the unread badge the instant the thread is opened, and catches
  // up delivery for a direct deep link that skipped /chat's own catch-up
  // (app/chat/page.tsx).
  await Promise.all([markConversationRead(conversation.id), markConversationDelivered(conversation.id)]);

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <BackLink fallbackHref="/chat" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <Link href={`/profile/${otherUser.username}`} className="flex items-center gap-2">
          <Avatar name={otherUser.full_name} src={otherUser.avatar_url} size={36} />
          <span className="text-sm font-semibold text-foreground">{otherUser.full_name}</span>
        </Link>
      </div>

      <ChatThread
        conversationId={conversation.id}
        myId={viewer.id}
        conversationType="dm"
        otherUserId={otherUser.id}
        otherUserName={otherUser.full_name}
        initialMessages={messages}
        initialReadReceipts={readReceipts}
        initialDeliveryReceipts={deliveryReceipts}
      />
    </div>
  );
}
