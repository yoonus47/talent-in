import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  BookOpen,
  Calendar,
  Cpu,
  Dumbbell,
  Globe,
  GraduationCap,
  HeartHandshake,
  MapPin,
  MessageCircle,
  Music,
  Palette,
  PenLine,
  PenTool,
  Sparkles,
  TreePine,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import {
  getCurrentProfile,
  getFollowStats,
  getProfileByUsername,
  getUserPosts,
} from "@/lib/data";
import { toggleFollow } from "@/lib/actions/profile";
import { startConversation } from "@/lib/actions/chat";
import { categoryForHobby } from "@/lib/hobbies";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { FeedList } from "@/components/feed-list";
import { cn, joinedDate } from "@/lib/utils";

// lib/hobbies.ts's 11 categories, one icon each — the interest chips below
// are all still the same single accent color (see the gradient-restraint
// memory: variety belongs in the icons here, not in per-category colors),
// so this is what actually differentiates "Chess" from "Guitar" at a
// glance instead of a wall of identical gray-then-pink pills.
const HOBBY_CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Outdoor & Nature": TreePine,
  "Sports & Fitness": Dumbbell,
  "Music & Performance": Music,
  "Arts & Crafts": Palette,
  Writing: PenTool,
  "Volunteering & Community": HeartHandshake,
  "Technology & Digital": Cpu,
  "Internet & Online": Globe,
  Intellectual: BookOpen,
  "Food & Drink": UtensilsCrossed,
  Miscellaneous: Sparkles,
};

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
  const hasLocation = Boolean(profile.city || profile.state);

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

          {/* Posts · Followers · Following — karma used to sit here
              (profiles.community_points) but comes out for now, not
              replaced with another number: it was crowding out the
              bigger profile upgrade this stat row is now part of, and
              it'll get a proper home again later rather than a stand-in
              here. Posts links to the #posts section below, the same way
              Followers/Following already link to their own pages. */}
          <div className="mt-4 flex items-center gap-4 border-t border-border pt-4 text-sm">
            <a href="#posts" className="hover:underline">
              <strong>{items.length}</strong> <span className="text-muted-foreground">posts</span>
            </a>
            <Link href={`/profile/${profile.username}/followers`} className="hover:underline">
              <strong>{followers}</strong>{" "}
              <span className="text-muted-foreground">followers</span>
            </Link>
            <Link href={`/profile/${profile.username}/following`} className="hover:underline">
              <strong>{following}</strong>{" "}
              <span className="text-muted-foreground">following</span>
            </Link>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">About</h2>
        <div className="space-y-2.5 text-sm text-foreground">
          <div className="flex items-center gap-2.5">
            <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>
              Class {profile.grade}
              {profile.school ? ` · ${profile.school}` : ""}
            </span>
          </div>
          {hasLocation && (
            <div className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{[profile.city, profile.state].filter(Boolean).join(", ")}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>Joined {joinedDate(profile.created_at)}</span>
          </div>
        </div>
      </Card>

      {profile.interests.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Interests</h2>
          <div className="flex flex-wrap gap-2">
            {profile.interests.map((interest) => {
              const Icon = HOBBY_CATEGORY_ICONS[categoryForHobby(interest) ?? "Miscellaneous"];
              return (
                <Badge key={interest} variant="accent" className="gap-1">
                  <Icon className="h-3 w-3" />
                  {interest}
                </Badge>
              );
            })}
          </div>
        </Card>
      )}

      <div>
        <h2 id="posts" className="mb-2 text-sm font-semibold text-muted-foreground">
          Posts
        </h2>
        {items.length === 0 ? (
          <EmptyState
            icon={PenLine}
            title={isOwnProfile ? "You haven't posted yet" : `${profile.full_name} hasn't posted yet`}
          />
        ) : (
          <FeedList items={items} viewer={viewer} />
        )}
      </div>
    </div>
  );
}
