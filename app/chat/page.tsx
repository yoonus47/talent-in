import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getConversations, getCurrentProfile, getMutualFollowProfiles } from "@/lib/data";
import { markConversationDelivered } from "@/lib/actions/chat";
import { ConversationRow } from "@/components/conversation-row";
import { NewChatPicker } from "@/components/new-chat-picker";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/ui/card";

export default async function ChatListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const [conversations, mutualFollows] = await Promise.all([
    getConversations(profile.id),
    getMutualFollowProfiles(profile.id),
  ]);

  // Catch-up delivery: whatever arrived while this user's device was
  // fully offline (app not open anywhere — see components/chat-fab-
  // button.tsx's global subscription for the live case) all catches up
  // the moment they open their inbox, same as a phone syncing on reconnect.
  await Promise.all(conversations.map((c) => markConversationDelivered(c.id)));

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Wherever the viewer opened chat from (a profile, the feed,
              wherever) — not a fixed destination, see components/back-
              link.tsx. This is the one page in the chat section that used
              to have no way back at all except the main nav tabs. */}
          <BackLink fallbackHref="/feed" aria-label="Back">
            <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </BackLink>
          <h1 className="text-lg font-bold">Messages</h1>
        </div>
        <NewChatPicker candidates={mutualFollows} />
      </div>

      {conversations.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No conversations yet. Message someone you follow (and who follows you back) to start
          chatting.
        </Card>
      ) : (
        <Card className="divide-y divide-border p-0">
          {conversations.map((conversation) => (
            <ConversationRow key={conversation.id} conversation={conversation} />
          ))}
        </Card>
      )}
    </div>
  );
}
