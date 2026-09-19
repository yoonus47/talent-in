import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile, getFeedPosts } from "@/lib/data";
import { Composer } from "@/components/composer";
import { FeedList } from "@/components/feed-list";
import { EndOfFeed } from "@/components/end-of-feed";
import { Card } from "@/components/ui/card";

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
        <Card className="animate-fade-up p-8 text-center text-sm text-muted-foreground">
          Your feed is quiet. Follow a few people from{" "}
          <Link href="/discover" className="font-medium text-primary hover:underline">
            Discover
          </Link>{" "}
          or post something yourself to get started.
        </Card>
      ) : (
        <>
          <FeedList items={items} viewer={profile} />
          <EndOfFeed />
        </>
      )}
    </div>
  );
}
