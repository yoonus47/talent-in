import { redirect } from "next/navigation";
import { getConversations, getCurrentProfile, getMutualFollowProfiles } from "@/lib/data";
import { ConversationRow } from "@/components/conversation-row";
import { NewChatPicker } from "@/components/new-chat-picker";
import { Card } from "@/components/ui/card";

export default async function ChatListPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const [conversations, mutualFollows] = await Promise.all([
    getConversations(profile.id),
    getMutualFollowProfiles(profile.id),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Messages</h1>
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
