import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getConversation,
  getCurrentProfile,
  getMessages,
  getOtherLastReadAt,
  getOtherParticipant,
} from "@/lib/data";
import { markConversationRead } from "@/lib/actions/chat";
import { ChatThread } from "@/components/chat-thread";
import { Avatar } from "@/components/ui/avatar";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/onboarding");

  // getConversation only returns a row if `viewer` is actually a
  // participant — the same guard RLS already enforces, checked again here
  // so a stranger hitting this URL directly gets a 404, not an empty page.
  const conversation = await getConversation(id, viewer.id);
  if (!conversation) notFound();

  const otherUser = await getOtherParticipant(conversation, viewer.id);
  if (!otherUser) notFound();

  const [messages, otherLastReadAt] = await Promise.all([
    getMessages(conversation.id),
    getOtherLastReadAt(conversation.id, otherUser.id),
  ]);

  // Clears the unread badge the instant the thread is opened.
  await markConversationRead(conversation.id);

  return (
    <div className="mx-auto max-w-xl">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link href="/chat" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </Link>
        <Link href={`/profile/${otherUser.username}`} className="flex items-center gap-2">
          <Avatar name={otherUser.full_name} src={otherUser.avatar_url} size={36} />
          <span className="text-sm font-semibold text-foreground">{otherUser.full_name}</span>
        </Link>
      </div>

      <ChatThread
        conversationId={conversation.id}
        myId={viewer.id}
        otherUserId={otherUser.id}
        initialMessages={messages}
        initialOtherLastReadAt={otherLastReadAt}
      />
    </div>
  );
}
