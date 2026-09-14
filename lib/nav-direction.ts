import { isActiveRoute } from "@/lib/nav-links";

/**
 * The slide-in-from-left/right direction for the NEXT page's entrance
 * animation (components/swipe-navigator.tsx's AnimatedPage), communicated
 * across a navigation via sessionStorage since the two pages involved are
 * two different component trees, not something React state can carry
 * across. A completed swipe-drag gesture already reads/writes this
 * (SwipeNavigator animates the drag itself, then sets this before the
 * router.push so the *destination* page's own entrance still gets the
 * matching direction) — this module just gives a plain click the same
 * capability, via setNavDirection below.
 */
const DIRECTION_KEY = "talentzify-swipe-direction";
export type NavDirection = "forward" | "back";

export function setNavDirection(direction: NavDirection) {
  try {
    sessionStorage.setItem(DIRECTION_KEY, direction);
  } catch {
    // sessionStorage can throw in some locked-down browser contexts —
    // just skip the animation rather than fail the navigation.
  }
}

export function readNavDirection(): NavDirection | null {
  try {
    const value = sessionStorage.getItem(DIRECTION_KEY);
    return value === "forward" || value === "back" ? value : null;
  } catch {
    return null;
  }
}

export function clearNavDirection() {
  try {
    sessionStorage.removeItem(DIRECTION_KEY);
  } catch {
    // ignore
  }
}

/**
 * Which way a tap between two tabs should slide, matching the rule
 * components/swipe-navigator.tsx already uses for a drag (comparing tab
 * order, not screen position) — so tapping a tab several positions away
 * animates the same direction swiping there would have. Defaults to
 * "forward" when either route isn't found in `links` or they resolve to
 * the same tab (e.g. re-tapping the active tab) — navigation is a no-op
 * in both those cases, so the direction is never actually observed.
 */
export function directionBetweenTabs(
  links: { href: string }[],
  fromPathname: string,
  toHref: string,
): NavDirection {
  const fromIndex = links.findIndex((link) => isActiveRoute(fromPathname, link.href));
  const toIndex = links.findIndex((link) => isActiveRoute(toHref, link.href));
  if (fromIndex === -1 || toIndex === -1) return "forward";
  return toIndex < fromIndex ? "back" : "forward";
}
