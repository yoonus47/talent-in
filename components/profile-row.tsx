import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions/profile";
import type { ProfileWithFollowState } from "@/lib/data";

/**
 * One row for any "list of people" surface — Discover's People tab,
 * followers/following pages, suggestions. Whole row links to the profile;
 * the follow button is its own form so clicking it doesn't navigate.
 */
export function ProfileRow({
  profile,
  meta,
}: {
  profile: ProfileWithFollowState;
  /** Optional context line under the name — defaults to grade/school. */
  meta?: string;
}) {
  const defaultMeta = [
    profile.grade ? `Class ${profile.grade}` : null,
    profile.school,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <Link href={`/profile/${profile.username}`} className="flex min-w-0 items-center gap-3">
        <Avatar name={profile.full_name} src={profile.avatar_url} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{profile.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{profile.username}
            {(meta ?? defaultMeta) && ` · ${meta ?? defaultMeta}`}
          </p>
        </div>
      </Link>
      <form action={toggleFollow.bind(null, profile.id, profile.isFollowing)}>
        <Button type="submit" size="sm" variant={profile.isFollowing ? "outline" : "primary"}>
          {profile.isFollowing ? "Following" : "Follow"}
        </Button>
      </form>
    </div>
  );
}
