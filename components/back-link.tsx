"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { setNavDirection } from "@/lib/nav-direction";

/**
 * A drop-in replacement for this app's "plain <Link> + ArrowLeft" back
 * button — same markup (pass your own icon/classes/children through as
 * before), but actually goes back to wherever the viewer came from
 * instead of a page-specific fixed destination:
 *
 * - `window.history.length > 1` means there's something real to pop back
 *   to (another page in this app, or the outside page that linked here —
 *   both are genuinely "wherever I came from") — router.back() for those.
 * - Otherwise (a fresh tab, a shared/deep link, or a reload landing
 *   directly on this URL) there's nothing to go back to; router.back()
 *   would either no-op or leave the app entirely, so `fallbackHref` (each
 *   caller's own previous hardcoded destination) is used instead.
 *
 * A plain <a> + preventDefault, not next/link — this needs to choose
 * which navigation API runs (back() vs push()) rather than just running
 * an onClick side-effect before Link's own push, like TransitionLink.
 */
export function BackLink({
  fallbackHref,
  onClick,
  ...rest
}: { fallbackHref: string } & ComponentProps<"a">) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    if (e.defaultPrevented) return;
    e.preventDefault();
    setNavDirection("back");
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return <a href={fallbackHref} onClick={handleClick} {...rest} />;
}
