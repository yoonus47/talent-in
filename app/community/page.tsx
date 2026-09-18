import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { getCommunityThreads, getCommunityTopics, getCurrentProfile } from "@/lib/data";
import { CommunityThreadRow } from "@/components/community-thread-row";
import { TransitionLink } from "@/components/transition-link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; q?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const { topic: topicSlug, q } = await searchParams;
  const query = q?.trim() || undefined;
  const topics = await getCommunityTopics();
  const activeTopic = topicSlug ? topics.find((t) => t.slug === topicSlug) : undefined;
  const threads = await getCommunityThreads(profile.id, activeTopic?.id, query);

  // Preserves whichever of topic/search the viewer already has active when
  // they change the other one — a chip tap shouldn't silently drop a
  // search, and searching shouldn't silently drop a topic filter.
  const withQuery = (href: string) => (query ? `${href}${href.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}` : href);

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

      <form method="get" className="mt-5">
        {activeTopic && <input type="hidden" name="topic" value={activeTopic.slug} />}
        <div className="relative">
          {/* A real submit button, not just a decorative icon — unlike
              Discover's own search field (app/discover/page.tsx), which
              always sits next to an explicit "Apply" button for its other
              filters, this field has nothing else nearby to submit it, so
              it can't rely on implicit Enter-to-submit alone. */}
          <button
            type="submit"
            aria-label="Search"
            className="absolute left-0 top-0 flex h-full w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search threads…"
            className="pl-9"
          />
        </div>
      </form>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <Link
          href={withQuery("/community")}
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
            href={withQuery(`/community?topic=${t.slug}`)}
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
            {query
              ? `No threads matching "${query}" here.`
              : "No threads here yet — be the first to start one."}
          </Card>
        ) : (
          threads.map((thread) => <CommunityThreadRow key={thread.id} thread={thread} />)
        )}
      </div>
    </div>
  );
}
