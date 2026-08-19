import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentProfile, getFeedPosts } from "@/lib/data";
import { Composer } from "@/components/composer";
import { PostCard } from "@/components/post-card";
import { Card } from "@/components/ui/card";

export default async function FeedPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const posts = await getFeedPosts(profile.id);

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Composer profile={profile} />

      {posts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Your feed is quiet. Follow a few people from{" "}
          <Link href="/discover" className="font-medium text-primary hover:underline">
            Discover
          </Link>{" "}
          or post something yourself to get started.
        </Card>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
}
