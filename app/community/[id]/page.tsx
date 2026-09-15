import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCommunityReplies, getCommunityThread, getCurrentProfile } from "@/lib/data";
import { BackLink } from "@/components/back-link";
import { CommunityReplyComposer } from "@/components/community-reply-composer";
import { DeleteCommunityReplyButton } from "@/components/delete-community-reply-button";
import { DeleteCommunityThreadButton } from "@/components/delete-community-thread-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/utils";

export default async function CommunityThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/onboarding");

  const { id } = await params;
  const thread = await getCommunityThread(id);
  if (!thread) notFound();

  const replies = await getCommunityReplies(id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <BackLink fallbackHref="/community" aria-label="Back to community">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <Badge variant="outline">{thread.topic.name}</Badge>
      </div>

      <Card className="p-6">
        <h1 className="text-xl font-bold text-foreground">{thread.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar name={thread.author.full_name} src={thread.author.avatar_url} size={24} />
          <Link
            href={`/profile/${thread.author.username}`}
            className="font-medium text-foreground hover:underline"
          >
            {thread.author.full_name}
          </Link>
          <span>·</span>
          <span>{timeAgo(thread.created_at)}</span>
          {thread.author.id === viewer.id && (
            <DeleteCommunityThreadButton threadId={thread.id} className="ml-auto" />
          )}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm text-foreground">{thread.body}</p>
      </Card>

      <div className="mt-6 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {replies.length} {replies.length === 1 ? "reply" : "replies"}
        </h2>

        {replies.map((reply) => (
          <div key={reply.id} className="flex items-start gap-2 text-sm">
            <Link href={`/profile/${reply.author.username}`} className="shrink-0">
              <Avatar name={reply.author.full_name} src={reply.author.avatar_url} size={28} />
            </Link>
            <div className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2">
              <div className="flex items-center gap-2">
                <Link
                  href={`/profile/${reply.author.username}`}
                  className="text-xs font-semibold text-foreground hover:underline"
                >
                  {reply.author.full_name}
                </Link>
                <span className="text-xs text-muted-foreground">{timeAgo(reply.created_at)}</span>
                {reply.author.id === viewer.id && (
                  <DeleteCommunityReplyButton
                    replyId={reply.id}
                    threadId={thread.id}
                    className="ml-auto"
                  />
                )}
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-foreground">{reply.content}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <CommunityReplyComposer threadId={thread.id} />
      </div>
    </div>
  );
}
