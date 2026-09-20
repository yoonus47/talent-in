"use client";

import { usePathname } from "next/navigation";
import { DEFAULT_NAV_ICON, NAV_ICONS, isActiveRoute, type NavRoute } from "@/lib/nav-links";
import { directionBetweenTabs } from "@/lib/nav-direction";
import { TransitionLink } from "@/components/transition-link";
import { cn } from "@/lib/utils";

export type NavLink = NavRoute;

/**
 * The Feed/Dashboard/Discover/Career Quiz/Profile links, in both their
 * desktop (horizontal, icon + label pills, rendered by Navbar inside its
 * sticky top header) and mobile (a real bottom tab bar, icon over label,
 * fixed to the viewport bottom — thumb-reach, the way every app this
 * audience already uses places its own nav — rendered by
 * components/mobile-tab-bar.tsx) forms. Split out of Navbar (a Server
 * Component) since highlighting the active route needs usePathname(),
 * which needs "use client" — Navbar itself stays server-rendered for its
 * data fetching.
 */
export function NavLinks({ links, variant }: { links: NavLink[]; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();

  // Hides on mobile specifically under `/chat/*` (an open thread, its
  // info panel, or the new-group form) — same route match and same
  // reason components/theme-toggle.tsx's old floating button used to
  // hide there: a `fixed` element can't reliably track "the bottom"
  // while iOS Safari's on-screen keyboard animates the visual viewport,
  // and those pages want the full height anyway. The bare `/chat` list
  // keeps the tab bar, same as it always could navigate away from there.
  const hideOnMobile = pathname.startsWith("/chat/");

  if (variant === "desktop") {
    return (
      <div className="hidden items-center gap-1 text-sm font-medium sm:flex">
        {links.map((link) => {
          const active = isActiveRoute(pathname, link.href);
          const Icon = NAV_ICONS[link.href] ?? DEFAULT_NAV_ICON;
          return (
            <TransitionLink
              key={link.href}
              href={link.href}
              // Same forward/back rule a swipe between these same tabs
              // already uses (lib/nav-direction.ts) — so tapping a tab
              // slides the same direction swiping there would have.
              direction={directionBetweenTabs(links, pathname, link.href)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </TransitionLink>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur sm:hidden",
        hideOnMobile && "hidden",
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around py-1.5">
        {links.map((link) => {
          const active = isActiveRoute(pathname, link.href);
          const Icon = NAV_ICONS[link.href] ?? DEFAULT_NAV_ICON;
          return (
            <TransitionLink
              key={link.href}
              href={link.href}
              direction={directionBetweenTabs(links, pathname, link.href)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {link.label}
            </TransitionLink>
          );
        })}
      </div>
    </div>
  );
}
