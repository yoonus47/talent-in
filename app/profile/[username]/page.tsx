import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MessageCircle, PenLine, Trophy } from "lucide-react";
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
      <Card className="overflow-hidden p-0">
        {/* Twitter/Instagram-style banner + overlapping avatar. Originally
            a solid --gradient-brand fill, same mistake as the dashboard
            promo card and the scratch card surface — a profile is viewed
            constantly, not a rare "special moment", so full saturated
            brand color here read as loud rather than premium. Calm
            muted/border foil instead (matches the scratch card's own
            treatment) — the banner+overlap layout itself is what gives
            this page its identity now, not the color. */}
        <div
          className="h-24"
          style={{ background: "linear-gradient(135deg, var(--muted), var(--border))" }}
        />

        <div className="px-6 pb-6">
          {/* items-end, not items-center: the avatar is much taller than
              the action button(s) beside it — end-aligning keeps the
              button's baseline near the avatar's bottom instead of
              floating awkwardly near its vertical center. */}
          <div className="flex items-end justify-between gap-3">
            <Avatar
              name={profile.full_name}
              src={profile.avatar_url}
              size={88}
              className="-mt-11 shrink-0 ring-4 ring-card"
            />

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

          {/* min-w-0 (+ break-words): a long full_name used to force this
              block past the card's edge — a flex item's default min-width
              is content-based, so an unbroken long/hyphenated name refused
              to shrink. min-w-0 here is now belt-and-suspenders (the block
              isn't sharing a row with anything anymore) but costs nothing
              to keep. */}
          <div className="mt-3 min-w-0">
            <h1 className="text-lg font-bold break-words">{profile.full_name}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          </div>

          {profile.bio && <p className="mt-3 text-sm text-foreground">{profile.bio}</p>}

          <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
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

          <div className="mt-4 flex items-center gap-4 border-t border-border pt-4 text-sm">
            <Link href={`/profile/${profile.username}/followers`} className="hover:underline">
              <strong>{followers}</strong>{" "}
              <span className="text-muted-foreground">followers</span>
            </Link>
            <Link href={`/profile/${profile.username}/following`} className="hover:underline">
              <strong>{following}</strong>{" "}
              <span className="text-muted-foreground">following</span>
            </Link>
            {/* Community karma — profiles.community_points is publicly
                readable (unlike challenge_attempts, which is locked to
                auth.uid() via RLS and would silently show 0 for anyone
                but the viewer's own profile), same Trophy icon
                app/dashboard/page.tsx uses for its own points stat. Not a
                link: no per-user community-activity page exists yet. */}
            <span className="flex items-center gap-1" title="Community karma">
              <Trophy className="h-3.5 w-3.5 text-accent" />
              <strong>{profile.community_points}</strong>{" "}
              <span className="text-muted-foreground">karma</span>
            </span>
          </div>
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
