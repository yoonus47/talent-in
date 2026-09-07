import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { getCurrentProfile, getUnreadNotificationCount } from "@/lib/data";
import { getNavRoutes } from "@/lib/nav-links";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notification-bell";
import { NavLinks } from "@/components/nav-links";

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
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/feed" className="brand-gradient-text text-lg font-bold">
          TalentZify
        </Link>

        <NavLinks links={links} variant="desktop" />

        <div className="flex items-center gap-3">
          <NotificationBell userId={profile.id} initialUnreadCount={unreadCount} />
          <Link href="/settings" title="Settings">
            <Avatar name={profile.full_name} src={profile.avatar_url} size={32} />
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Log out
            </button>
          </form>
        </div>
      </nav>
      <NavLinks links={links} variant="mobile" />
    </header>
  );
}
