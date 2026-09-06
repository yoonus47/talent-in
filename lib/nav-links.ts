import { Compass, GraduationCap, Home, LayoutDashboard, User, type LucideIcon } from "lucide-react";

export type NavRoute = { href: string; label: string };

/**
 * The Feed/Dashboard/Discover/Career Quiz/Profile tab order — shared by
 * components/navbar.tsx (what's rendered) and components/swipe-navigator.tsx
 * (what swiping left/right moves between), so the two can never drift out
 * of sync with each other.
 */
export function getNavRoutes(username: string): NavRoute[] {
  return [
    { href: "/feed", label: "Feed" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/discover", label: "Discover" },
    { href: "/quiz", label: "Career Quiz" },
    { href: `/profile/${username}`, label: "Profile" },
  ];
}

/** Icon per route — also shared between NavLinks and the swipe peek card,
 * so adding a tab only ever needs updating in one place. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  "/feed": Home,
  "/dashboard": LayoutDashboard,
  "/discover": Compass,
  "/quiz": GraduationCap,
};

/** Fallback icon for any route not in NAV_ICONS (e.g. the Profile tab,
 * whose href is per-user). Exported alongside NAV_ICONS so call sites do
 * `NAV_ICONS[href] ?? DEFAULT_NAV_ICON` inline — a direct map lookup,
 * not a wrapper function call, which a stricter eslint rule
 * (react-hooks/static-components) flags as "creating a component during
 * render" even though nothing is actually being created, just selected. */
export const DEFAULT_NAV_ICON: LucideIcon = User;

export function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
