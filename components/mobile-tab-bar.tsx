import { getCurrentProfile } from "@/lib/data";
import { getNavRoutes } from "@/lib/nav-links";
import { NavLinks } from "@/components/nav-links";

/**
 * The real mobile navigation surface — fixed to the bottom of the
 * viewport, in thumb-reach, the way every app this audience already uses
 * (Instagram, TikTok, Snapchat, YouTube) places its own tab bar. Used to
 * be a second row rendered inside components/navbar.tsx's sticky *top*
 * header instead; extracted here once it was clear that put primary
 * navigation as far from a one-handed thumb as the screen allows. All the
 * actual positioning/hide-on-`/chat/*` logic lives in NavLinks itself
 * (already a client component, for usePathname) — this is just the
 * server-side data fetch.
 *
 * getCurrentProfile is cache()-wrapped, so this doesn't cost a second
 * Supabase round trip on top of Navbar's own call (same reasoning as
 * ChatFab's own comment).
 */
export async function MobileTabBar() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const links = getNavRoutes(profile.username);

  return <NavLinks links={links} variant="mobile" />;
}
