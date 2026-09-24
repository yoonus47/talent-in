import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Flame, MessagesSquare, Pin, Plus, Search, Sparkles } from "lucide-react";
import { getCommunityThreads, getCommunityTopics, getCurrentProfile } from "@/lib/data";
import { CommunityThreadRow } from "@/components/community-thread-row";
import { TransitionLink } from "@/components/transition-link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; q?: string; sort?: string; mine?: string; saved?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const { topic: topicSlug, q, sort: sortParam, mine, saved } = await searchParams;
  const query = q?.trim() || undefined;
  const sort = sortParam === "hot" ? "hot" : "new";
  const onlyFollowing = mine === "1";
  const onlySaved = saved === "1";
  const topics = await getCommunityTopics();
  const activeTopic = topicSlug ? topics.find((t) => t.slug === topicSlug) : undefined;
  const threads = await getCommunityThreads(profile.id, {
    topicId: activeTopic?.id,
    searchQuery: query,
    sort,
    onlyFollowing,
    onlySaved,
  });

  // Pinned threads (author-curated, no site-wide admin concept here — see
  // lib/actions/community.ts's setCommunityThreadPinned) get their own
  // section above the regular list, but only on the plain "newest" view —
  // mixing them into a Hot ranking or a personal Following/Saved filter
  // would fight both of those views' own point.
  const showPinnedSection = sort === "new" && !onlyFollowing && !onlySaved;
  const pinnedThreads = showPinnedSection ? threads.filter((t) => t.is_pinned) : [];
  const regularThreads = showPinnedSection ? threads.filter((t) => !t.is_pinned) : threads;

  // Preserves whichever of search/sort/following/saved the viewer already
  // has active when they change something else — a chip tap shouldn't
  // silently drop a search, switching to Hot shouldn't drop "mine," etc.
  function withParams(href: string, overrides: Record<string, string | undefined> = {}) {
    const params = new URLSearchParams();
    const merged = {
      q: query,
      sort: sort === "hot" ? "hot" : undefined,
      mine: onlyFollowing ? "1" : undefined,
      saved: onlySaved ? "1" : undefined,
      ...overrides,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `${href}${href.includes("?") ? "&" : "?"}${qs}` : href;
  }

  const chipClass =
    "shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors";
  const activeChip = "border-primary bg-primary text-primary-foreground";
  const inactiveChip = "border-border text-muted-foreground hover:bg-muted";

  return (
    <div className="animate-fade-up mx-auto max-w-xl px-4 py-6">
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

      <form method="get" className="mt-4">
        {activeTopic && <input type="hidden" name="topic" value={activeTopic.slug} />}
        {sort === "hot" && <input type="hidden" name="sort" value="hot" />}
        {onlyFollowing && <input type="hidden" name="mine" value="1" />}
        {onlySaved && <input type="hidden" name="saved" value="1" />}
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

      {/* relative+overlay, not overflow-hidden on this wrapper — the chip
          row itself still needs its own overflow-x-auto to scroll. The
          overlay just hints "more chips this way" (narrowing the page to
          match the rest of the app, see the container-width commit, made
          this row clip mid-word more often) the way most apps fade a
          horizontal-scroll edge instead of clipping it bare. */}
      <div className="relative mt-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link
            href={withParams("/community", { topic: undefined })}
            className={cn(chipClass, !activeTopic ? activeChip : inactiveChip)}
          >
            All
          </Link>
          {topics.map((t) => (
            <Link
              key={t.id}
              href={withParams("/community", { topic: t.slug })}
              className={cn(chipClass, activeTopic?.id === t.id ? activeChip : inactiveChip)}
            >
              {t.name}
            </Link>
          ))}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Link
          href={withParams("/community", { topic: activeTopic?.slug, sort: undefined })}
          className={cn(chipClass, "gap-1", sort === "new" ? activeChip : inactiveChip)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          New
        </Link>
        <Link
          href={withParams("/community", { topic: activeTopic?.slug, sort: "hot" })}
          className={cn(chipClass, "gap-1", sort === "hot" ? activeChip : inactiveChip)}
        >
          <Flame className="h-3.5 w-3.5" />
          Hot
        </Link>
        <Link
          href={withParams("/community", {
            topic: activeTopic?.slug,
            mine: onlyFollowing ? undefined : "1",
          })}
          className={cn(chipClass, "ml-auto", onlyFollowing ? activeChip : inactiveChip)}
        >
          Following
        </Link>
        <Link
          href={withParams("/community", {
            topic: activeTopic?.slug,
            saved: onlySaved ? undefined : "1",
          })}
          className={cn(chipClass, "gap-1", onlySaved ? activeChip : inactiveChip)}
        >
          <Bookmark className="h-3.5 w-3.5" />
          Saved
        </Link>
      </div>

      {activeTopic && (
        <p className="mt-2 text-sm text-muted-foreground">{activeTopic.description}</p>
      )}

      {pinnedThreads.length > 0 && (
        <div className="mt-5 space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Pin className="h-3.5 w-3.5" />
            Pinned
          </h2>
          {pinnedThreads.map((thread) => (
            <CommunityThreadRow key={thread.id} thread={thread} viewerId={profile.id} />
          ))}
        </div>
      )}

      <div className="mt-5 space-y-3">
        {regularThreads.length === 0 ? (
          <EmptyState
            icon={query ? Search : MessagesSquare}
            title={
              query
                ? `No threads matching "${query}"`
                : onlySaved
                  ? "You haven't saved any threads yet"
                  : onlyFollowing
                    ? "You're not following any threads yet"
                    : "No threads here yet"
            }
            description={
              query
                ? undefined
                : onlySaved
                  ? "Save a thread to find it here later."
                  : onlyFollowing
                    ? "Reply to or follow a thread to see it here."
                    : "Be the first to start one."
            }
          />
        ) : (
          regularThreads.map((thread) => (
            <CommunityThreadRow key={thread.id} thread={thread} viewerId={profile.id} />
          ))
        )}
      </div>
    </div>
  );
}
