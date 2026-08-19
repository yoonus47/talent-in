import { notFound, redirect } from "next/navigation";
import {
  getCurrentProfile,
  getFollowStats,
  getProfileByUsername,
  getUserPosts,
} from "@/lib/data";
import { toggleFollow } from "@/lib/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PostCard } from "@/components/post-card";
import { cn } from "@/lib/utils";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/login");

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const isOwnProfile = profile.id === viewer.id;
  const [{ followers, following, isFollowing }, posts] = await Promise.all([
    getFollowStats(profile.id, viewer.id),
    getUserPosts(profile.id, viewer.id),
  ]);

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={profile.full_name} src={profile.avatar_url} size={64} />
            <div>
              <h1 className="text-lg font-bold">{profile.full_name}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
          </div>

          {isOwnProfile ? (
            <a href="/settings" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Edit profile
            </a>
          ) : (
            <form action={toggleFollow.bind(null, profile.id, isFollowing)}>
              <Button type="submit" variant={isFollowing ? "outline" : "primary"} size="sm">
                {isFollowing ? "Following" : "Follow"}
              </Button>
            </form>
          )}
        </div>

        {profile.bio && <p className="mt-4 text-sm text-foreground">{profile.bio}</p>}

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
          {profile.grade && <Badge variant="outline">Class {profile.grade}</Badge>}
          {profile.school && <Badge variant="outline">{profile.school}</Badge>}
          {(profile.city || profile.state) && (
            <Badge variant="outline">
              {[profile.city, profile.state].filter(Boolean).join(", ")}
            </Badge>
          )}
        </div>

        {profile.interests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <Badge key={interest} variant="accent">
                {interest}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-4 flex gap-4 border-t border-border pt-4 text-sm">
          <span>
            <strong>{followers}</strong>{" "}
            <span className="text-muted-foreground">followers</span>
          </span>
          <span>
            <strong>{following}</strong>{" "}
            <span className="text-muted-foreground">following</span>
          </span>
        </div>
      </Card>

      {posts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {isOwnProfile ? "You haven't posted yet." : `${profile.full_name} hasn't posted yet.`}
        </Card>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
}
