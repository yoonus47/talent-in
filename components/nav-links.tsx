"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEFAULT_NAV_ICON, NAV_ICONS, isActiveRoute, type NavRoute } from "@/lib/nav-links";
import { cn } from "@/lib/utils";

export type NavLink = NavRoute;

/**
 * The Feed/Dashboard/Discover/Career Quiz/Profile links, in both their
 * desktop (horizontal, icon + label pills) and mobile (bottom tab bar,
 * icon over label) forms. Split out of Navbar (a Server Component) since
 * highlighting the active route needs usePathname(), which needs "use
 * client" — Navbar itself stays server-rendered for its data fetching.
 */
export function NavLinks({ links, variant }: { links: NavLink[]; variant: "desktop" | "mobile" }) {
  const pathname = usePathname();

  if (variant === "desktop") {
    return (
      <div className="hidden items-center gap-1 text-sm font-medium sm:flex">
        {links.map((link) => {
          const active = isActiveRoute(pathname, link.href);
          const Icon = NAV_ICONS[link.href] ?? DEFAULT_NAV_ICON;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-around border-t border-border py-1.5 sm:hidden">
      {links.map((link) => {
        const active = isActiveRoute(pathname, link.href);
        const Icon = NAV_ICONS[link.href] ?? DEFAULT_NAV_ICON;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
