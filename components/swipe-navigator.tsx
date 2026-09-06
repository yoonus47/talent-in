"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { NavRoute } from "@/lib/nav-links";
import { cn } from "@/lib/utils";

// sessionStorage, not a plain module-level variable — reading it is
// idempotent (safe if React's Strict Mode double-invokes the useState
// initializer below in dev), whereas an earlier version of this mutated a
// bare variable inside that initializer and silently broke: the
// throwaway first invocation consumed the signal before the real one
// could read it, so the animation class was always empty. Confirmed live
// with a simulated swipe before finding this.
const DIRECTION_KEY = "talentzify-swipe-direction";

const MIN_SWIPE_DISTANCE = 60;
// Require the gesture to be decisively horizontal, not a diagonal scroll.
const MIN_HORIZONTAL_RATIO = 1.5;

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function readAnimationClass(): string {
  try {
    const direction = sessionStorage.getItem(DIRECTION_KEY);
    if (direction === "forward") return "animate-slide-in-from-right";
    if (direction === "back") return "animate-slide-in-from-left";
  } catch {
    // sessionStorage can throw in some locked-down browser contexts —
    // just skip the animation rather than fail the navigation.
  }
  return "";
}

/**
 * Its own component (not just a plain <div key={pathname}> inline in
 * SwipeNavigator) is what actually matters here: a `key` only resets a
 * *component's* hooks when React unmounts/remounts that component — it
 * does nothing for hooks declared in an ancestor, which is exactly the
 * mistake an earlier version of this made (useState/useEffect lived in
 * SwipeNavigator itself, which never unmounts across navigations since
 * it's mounted once in the root layout, so keying an inner plain div had
 * no effect on them at all). Confirmed live: the animation class was
 * computed exactly once, on the app's very first load, and never again.
 */
function AnimatedPage({ children }: { children: React.ReactNode }) {
  const [animationClass] = useState(readAnimationClass);

  useEffect(() => {
    try {
      sessionStorage.removeItem(DIRECTION_KEY);
    } catch {
      // ignore
    }
  }, []);

  return <div className={cn("overflow-x-hidden", animationClass)}>{children}</div>;
}

/**
 * Instagram-style swipe-between-tabs, for touch devices only (it's driven
 * by touch events, so it never engages for mouse/desktop use regardless
 * of viewport width). Swiping left moves to the next tab in `links`
 * (Feed -> Dashboard -> Discover -> Career Quiz -> Profile), swiping
 * right moves to the previous one; there's no wraparound past either end.
 *
 * This is a real page navigation (router.push), not a live drag that
 * follows your finger — that level of interactive, cancelable gesture
 * transition is genuinely native-app territory (iOS's UIKit coordinates
 * that at the OS level) and not something a web app can replicate well.
 * What this does instead: the destination page's content plays a quick
 * directional slide-in on arrival, which is the deliverable approximation
 * of "smooth slide" achievable here — Next's own docs point at React's
 * <ViewTransition> for a fancier version of this, but it needs a React
 * canary build this project isn't on (confirmed: not exported by the
 * installed react package), so this uses a plain CSS entrance animation
 * instead.
 */
export function SwipeNavigator({ links, children }: { links: NavRoute[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || links.length === 0) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < MIN_SWIPE_DISTANCE || Math.abs(dx) < Math.abs(dy) * MIN_HORIZONTAL_RATIO) {
      return;
    }

    const currentIndex = links.findIndex((link) => isActiveRoute(pathname, link.href));
    if (currentIndex === -1) return;

    function setDirection(direction: "forward" | "back") {
      try {
        sessionStorage.setItem(DIRECTION_KEY, direction);
      } catch {
        // ignore — navigation still works, just without the entrance animation
      }
    }

    if (dx < 0 && currentIndex < links.length - 1) {
      setDirection("forward");
      router.push(links[currentIndex + 1].href);
    } else if (dx > 0 && currentIndex > 0) {
      setDirection("back");
      router.push(links[currentIndex - 1].href);
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="contents">
      <AnimatedPage key={pathname}>{children}</AnimatedPage>
    </div>
  );
}
