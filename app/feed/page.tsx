import { redirect } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { getCurrentProfile, getFeedPosts } from "@/lib/data";
import { Composer } from "@/components/composer";
import { FeedList } from "@/components/feed-list";
import { EndOfFeed } from "@/components/end-of-feed";
import { EmptyState } from "@/components/empty-state";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ prefill?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const items = await getFeedPosts(profile.id);
  // Crosspost-from-community's landing spot (app/community/[id]/page.tsx's
  // "Share to feed" link) — a plain pre-filled, still-editable draft, not
  // an auto-posted rich embed card. Deliberately the lightweight version:
  // a real nested "shared thread" preview would need FeedPost/getFeedItems
  // changes disproportionate to that round's actual scope.
  const { prefill } = await searchParams;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Composer profile={profile} defaultContent={prefill} />

      {items.length === 0 ? (
        <EmptyState
          className="animate-fade-up"
          icon={Users}
          title="Your feed is quiet"
          description={
            <>
              Follow a few people from{" "}
              <Link href="/discover" className="font-medium text-primary hover:underline">
                Discover
              </Link>{" "}
              or post something yourself to get started.
            </>
          }
        />
      ) : (
        <>
          <FeedList items={items} viewer={profile} />
          <EndOfFeed />
        </>
      )}
    </div>
  );
}
