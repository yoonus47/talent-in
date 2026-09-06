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
