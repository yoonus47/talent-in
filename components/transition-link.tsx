"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { setNavDirection, type NavDirection } from "@/lib/nav-direction";

/**
 * A drop-in next/link replacement that sets the entrance-animation
 * direction (lib/nav-direction.ts) before letting Link's own client-side
 * navigation proceed, so the destination page's AnimatedPage (components/
 * swipe-navigator.tsx) slides in instead of appearing as a hard cut — the
 * same animation a completed swipe gesture already gets, now on an
 * ordinary tap/click too.
 *
 * For a "this reverses/closes the current view" link, use BackLink
 * (components/back-link.tsx) instead — it also picks router.back() over
 * a fixed href when there's real history to pop.
 */
export function TransitionLink({
  direction,
  onClick,
  ...props
}: ComponentProps<typeof Link> & { direction: NavDirection }) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        setNavDirection(direction);
        onClick?.(e);
      }}
    />
  );
}
