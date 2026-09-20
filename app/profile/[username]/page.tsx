import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageCircle, PenLine } from "lucide-react";
import {
  getCurrentProfile,
  getFollowStats,
  getProfileByUsername,
  getUserPosts,
} from "@/lib/data";
import { toggleFollow } from "@/lib/actions/profile";
import { startConversation } from "@/lib/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/feed-list";
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
  const [{ followers, following, isFollowing, isFollowedBy }, items] = await Promise.all([
    getFollowStats(profile.id, viewer.id),
    getUserPosts(profile.id, viewer.id),
  ]);
  const isMutual = isFollowing && isFollowedBy;

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Card className="p-6">
        {/* min-w-0 (+ break-words on the name below): a long full_name used
            to force this row past the card's edge — a flex item's default
            min-width is content-based, so a long unbroken word/hyphenated
            name refused to shrink and pushed the action button(s) off the
            visible edge instead of the name simply wrapping onto more
            lines the way it should. min-w-0 lets this block actually
            shrink to make room, same as the button side keeps its size. */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={profile.full_name} src={profile.avatar_url} size={64} />
            <div className="min-w-0">
              <h1 className="text-lg font-bold break-words">{profile.full_name}</h1>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
          </div>

          {isOwnProfile ? (
            <a
              href="/settings"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Edit profile
            </a>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              {isMutual && (
                <form action={startConversation.bind(null, profile.id)}>
                  <Button type="submit" variant="outline" size="sm" aria-label="Message">
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </form>
              )}
              <form action={toggleFollow.bind(null, profile.id, isFollowing)}>
                <Button type="submit" variant={isFollowing ? "outline" : "primary"} size="sm">
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              </form>
            </div>
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
          <Link href={`/profile/${profile.username}/followers`} className="hover:underline">
            <strong>{followers}</strong>{" "}
            <span className="text-muted-foreground">followers</span>
          </Link>
          <Link href={`/profile/${profile.username}/following`} className="hover:underline">
            <strong>{following}</strong>{" "}
            <span className="text-muted-foreground">following</span>
          </Link>
        </div>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          icon={PenLine}
          title={isOwnProfile ? "You haven't posted yet" : `${profile.full_name} hasn't posted yet`}
        />
      ) : (
        <FeedList items={items} viewer={viewer} />
      )}
    </div>
  );
}
