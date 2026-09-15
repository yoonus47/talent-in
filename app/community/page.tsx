import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCommunityThreads, getCommunityTopics, getCurrentProfile } from "@/lib/data";
import { CommunityThreadRow } from "@/components/community-thread-row";
import { TransitionLink } from "@/components/transition-link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const { topic: topicSlug } = await searchParams;
  const topics = await getCommunityTopics();
  const activeTopic = topicSlug ? topics.find((t) => t.slug === topicSlug) : undefined;
  const threads = await getCommunityThreads(activeTopic?.id);

  const chipClass =
    "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <div className="animate-fade-up mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Community</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Threads, topics, and people figuring things out together.
          </p>
        </div>
        <TransitionLink
          href={activeTopic ? `/community/new?topic=${activeTopic.slug}` : "/community/new"}
          direction="forward"
          className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
        >
          <Plus className="h-4 w-4" />
          New thread
        </TransitionLink>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        <Link
          href="/community"
          className={cn(
            chipClass,
            !activeTopic
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          All
        </Link>
        {topics.map((t) => (
          <Link
            key={t.id}
            href={`/community?topic=${t.slug}`}
            className={cn(
              chipClass,
              activeTopic?.id === t.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {t.name}
          </Link>
        ))}
      </div>

      {activeTopic && (
        <p className="mt-3 text-sm text-muted-foreground">{activeTopic.description}</p>
      )}

      <div className="mt-6 space-y-3">
        {threads.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No threads here yet — be the first to start one.
          </Card>
        ) : (
          threads.map((thread) => <CommunityThreadRow key={thread.id} thread={thread} />)
        )}
      </div>
    </div>
  );
}
