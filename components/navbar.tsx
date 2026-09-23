import Link from "next/link";
import { getCurrentProfile, getUnreadNotificationCount } from "@/lib/data";
import { getNavRoutes } from "@/lib/nav-links";
import { NotificationBell } from "@/components/notification-bell";
import { NavLinks } from "@/components/nav-links";
import { UserMenu } from "@/components/user-menu";
import { APP_VERSION, VersionBadge } from "@/components/version-badge";

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
        <Link href="/feed" className="shrink-0 brand-gradient-text text-lg font-bold">
          TalentZify
        </Link>

        {/* NavLinks (desktop variant) renders nothing at all below lg —
            not just visually hidden, no box — so this middle slot is
            genuinely empty there today; the version badge (mobile-only,
            see components/version-badge.tsx — desktop gets its own fixed
            bottom-left placement instead, in app/layout.tsx) fills it,
            centered in the real remaining space rather than the whole nav
            width. min-w-0 here (and on the badge itself) is what lets it
            actually shrink and wrap onto two lines instead of overflowing
            — same fix this app's applied repeatedly elsewhere. */}
        <div className="flex min-w-0 flex-1 items-center justify-center">
          <NavLinks links={links} variant="desktop" />
          <VersionBadge className="lg:hidden">Alpha v{APP_VERSION} · developer preview</VersionBadge>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <NotificationBell userId={profile.id} initialUnreadCount={unreadCount} />
          <UserMenu fullName={profile.full_name} username={profile.username} avatarUrl={profile.avatar_url} />
        </div>
      </nav>
    </header>
  );
}
