import Link from "next/link";
import { getCurrentProfile, getUnreadNotificationCount } from "@/lib/data";
import { getNavRoutes } from "@/lib/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { NavLinks } from "@/components/nav-links";
import { UserMenu } from "@/components/user-menu";
import { VersionBadge } from "@/components/version-badge";

export async function Navbar() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const unreadCount = await getUnreadNotificationCount(profile.id);
  const links = getNavRoutes(profile.username);

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      {/* max-w-4xl, not max-w-3xl (every other page's own container is
          narrower still) — the icon+label pills in NavLinks need more
          room than the old plain-text links did; at max-w-3xl "Log out"
          was overflowing onto two lines. */}
      <nav className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/feed" className="brand-gradient-text text-lg font-bold">
            TalentZify
          </Link>
          {/* NavLinks' own pills already fill this row's middle at lg+ —
              the badge only has room beside the wordmark there. Below lg
              it's the other way around (see the middle slot below). */}
          <VersionBadge className="hidden lg:inline-flex" />
        </div>

        {/* NavLinks (desktop variant) renders nothing at all below lg —
            not just visually hidden, no box — so this middle slot is
            genuinely empty there today. Both children share it and are
            mutually exclusive by breakpoint, so whichever one is active
            gets centered in the real remaining space, not the whole nav
            width (an absolute-centered badge risked colliding with the
            wordmark/avatar cluster on a narrow phone; this doesn't). */}
        <div className="flex flex-1 items-center justify-center">
          <NavLinks links={links} variant="desktop" />
          <VersionBadge className="lg:hidden" />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <NotificationBell userId={profile.id} initialUnreadCount={unreadCount} />
          <UserMenu fullName={profile.full_name} username={profile.username} avatarUrl={profile.avatar_url} />
        </div>
      </nav>
    </header>
  );
}
