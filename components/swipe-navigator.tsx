"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DEFAULT_NAV_ICON, NAV_ICONS, isActiveRoute, type NavRoute } from "@/lib/nav-links";

// SSR-safe useLayoutEffect: this only ever runs in the browser (the
// component is "use client" and the effect touches refs/DOM), but plain
// useLayoutEffect logs a harmless React warning when the *initial* render
// happens on the server, which this component's does. Swapping to
// useEffect during SSR (a no-op there anyway) avoids that noise without
// changing behavior on the client, where it's still useLayoutEffect.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Entrance animation for *plain* Link-tap navigation (see AnimatedPage
// below) — a completed drag handles its own motion end-to-end instead and
// doesn't touch this, so the two mechanisms never fight each other.
const DIRECTION_KEY = "talentzify-swipe-direction";

const DIRECTION_LOCK_PX = 10; // how far a touch has to move before committing to horizontal vs vertical
const MIN_HORIZONTAL_RATIO = 1.3; // how much more horizontal than vertical a drag has to be
const COMMIT_MS = 240;
const SNAP_BACK_MS = 220;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

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
 * does nothing for hooks declared in an ancestor. Confirmed live: an
 * earlier version keyed a plain div while the hooks lived in
 * SwipeNavigator itself (which never unmounts, since it's mounted once in
 * the root layout), and the animation class was computed exactly once,
 * ever, on the app's first load.
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

  return <div className={animationClass}>{children}</div>;
}

/** The destination tab's icon + label, shown as it peeks in from the
 * edge — its own component (not a variable computed inline in
 * SwipeNavigator's render) so the icon lookup isn't "creating a
 * component during render" from the linter's perspective. */
function PeekCard({ link }: { link: NavRoute }) {
  const Icon = NAV_ICONS[link.href] ?? DEFAULT_NAV_ICON;
  return (
    <>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Icon className="h-7 w-7" />
      </div>
      <span className="text-base font-semibold text-foreground">{link.label}</span>
    </>
  );
}

type Direction = "forward" | "back";

type GestureState = {
  startX: number;
  startY: number;
  dx: number;
  lockedDirection: "horizontal" | "vertical" | null;
  swipeDirection: Direction | null;
  targetLink: NavRoute | null;
};

/**
 * Instagram-style swipe-between-tabs: a live drag that follows your
 * finger, with the destination tab peeking in from the edge as you drag,
 * committed only past the halfway point of the screen (snaps back
 * otherwise) — not a bare "swipe triggers an instant navigation" like an
 * earlier version of this. High-frequency updates (every touchmove) go
 * straight to the DOM via refs instead of React state, which would
 * re-render on every tick; React state only tracks the few *discrete*
 * things that actually need it (which tab is peeking).
 *
 * This is still a real page navigation once committed (router.push), not
 * a persisted single-page carousel — genuinely rendering the destination
 * tab's live server data mid-drag would need turning all 5 tabs into one
 * always-mounted view, a much larger rebuild. The peek card shows the
 * destination's icon/label, not its real content, as the honest
 * middle ground: full drag-follow physics and a real commit threshold,
 * without pretending the actual next page is already loaded.
 */
export function SwipeNavigator({ links, children }: { links: NavRoute[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<GestureState | null>(null);
  const animating = useRef(false);

  // `direction` alongside the link matters: it drives the peek's initial
  // off-screen side (right for a "forward" swipe, left for "back"). This
  // has to be correct from the very first declarative render — a
  // same-tick imperative "prime" step can't be relied on, since a fast
  // enough sequence of touchmove events (confirmed with back-to-back
  // synthetic events in testing) can fire before React has mounted the
  // peek div at all, i.e. before there's a ref to prime.
  const [peek, setPeek] = useState<{ link: NavRoute; direction: Direction } | null>(null);

  // Whenever we land on a new page (committed swipe, plain Link click, or
  // the browser back/forward button), reset transforms instantly with no
  // transition — before paint, so the new content never flashes at a
  // leftover offset from the page this replaced.
  useIsomorphicLayoutEffect(() => {
    if (pageRef.current) {
      pageRef.current.style.transition = "none";
      pageRef.current.style.transform = "translateX(0)";
    }
    animating.current = false;
    gesture.current = null;
    setPeek(null);
  }, [pathname]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onTouchStart(e: TouchEvent) {
      if (animating.current) return;
      const touch = e.touches[0];
      gesture.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        dx: 0,
        lockedDirection: null,
        swipeDirection: null,
        targetLink: null,
      };
    }

    function onTouchMove(e: TouchEvent) {
      const state = gesture.current;
      if (!state) return;
      const touch = e.touches[0];
      const rawDx = touch.clientX - state.startX;
      const rawDy = touch.clientY - state.startY;

      if (state.lockedDirection === null) {
        if (Math.abs(rawDx) < DIRECTION_LOCK_PX && Math.abs(rawDy) < DIRECTION_LOCK_PX) return;

        if (Math.abs(rawDx) <= Math.abs(rawDy) * MIN_HORIZONTAL_RATIO) {
          // A scroll, not a swipe — stop tracking and let the browser
          // handle it natively (never called preventDefault, so it
          // already has been).
          gesture.current = null;
          return;
        }

        state.lockedDirection = "horizontal";
        state.swipeDirection = rawDx < 0 ? "forward" : "back";

        const currentIndex = links.findIndex((link) => isActiveRoute(pathname, link.href));
        state.targetLink =
          state.swipeDirection === "forward"
            ? currentIndex >= 0 && currentIndex < links.length - 1
              ? links[currentIndex + 1]
              : null
            : currentIndex > 0
              ? links[currentIndex - 1]
              : null;
        if (state.targetLink) {
          setPeek({ link: state.targetLink, direction: state.swipeDirection });
        }

        // Best-effort synchronous prime, for the common case where the
        // peek div is already mounted from an earlier gesture on this
        // same page — the declarative style (computed from `peek.direction`
        // below) is what guarantees correctness even when it isn't.
        if (peekRef.current) {
          const width = window.innerWidth;
          peekRef.current.style.transition = "none";
          peekRef.current.style.transform = `translateX(${state.swipeDirection === "forward" ? width : -width}px)`;
        }
      }

      if (state.lockedDirection !== "horizontal") return;

      e.preventDefault();

      const width = window.innerWidth;
      let dx = state.swipeDirection === "forward" ? Math.min(0, rawDx) : Math.max(0, rawDx);
      if (!state.targetLink) {
        // No tab in that direction (already at the first/last one) —
        // rubber-band resist instead of moving freely.
        dx = dx / 4;
      } else {
        dx = state.swipeDirection === "forward" ? Math.max(dx, -width) : Math.min(dx, width);
      }
      state.dx = dx;

      if (pageRef.current) {
        pageRef.current.style.transition = "none";
        pageRef.current.style.transform = `translateX(${dx}px)`;
      }
      if (peekRef.current && state.targetLink) {
        const peekX = state.swipeDirection === "forward" ? width + dx : -width + dx;
        peekRef.current.style.transition = "none";
        peekRef.current.style.transform = `translateX(${peekX}px)`;
      }
    }

    function onTouchEnd() {
      const state = gesture.current;
      gesture.current = null;
      if (!state || state.lockedDirection !== "horizontal") return;

      const width = window.innerWidth;
      const pastHalfway = Math.abs(state.dx) >= width / 2;

      if (pastHalfway && state.targetLink) {
        animating.current = true;
        const finalX = state.swipeDirection === "forward" ? -width : width;
        if (pageRef.current) {
          pageRef.current.style.transition = `transform ${COMMIT_MS}ms ${EASING}`;
          pageRef.current.style.transform = `translateX(${finalX}px)`;
        }
        if (peekRef.current) {
          peekRef.current.style.transition = `transform ${COMMIT_MS}ms ${EASING}`;
          peekRef.current.style.transform = "translateX(0)";
        }
        const targetHref = state.targetLink.href;
        setTimeout(() => router.push(targetHref), COMMIT_MS);
      } else {
        animating.current = true;
        if (pageRef.current) {
          pageRef.current.style.transition = `transform ${SNAP_BACK_MS}ms ${EASING}`;
          pageRef.current.style.transform = "translateX(0)";
        }
        if (peekRef.current && state.targetLink) {
          const width2 = window.innerWidth;
          peekRef.current.style.transition = `transform ${SNAP_BACK_MS}ms ${EASING}`;
          peekRef.current.style.transform = `translateX(${state.swipeDirection === "forward" ? width2 : -width2}px)`;
        }
        setTimeout(() => {
          animating.current = false;
          setPeek(null);
        }, SNAP_BACK_MS);
      }
    }

    // touchmove must be a non-passive *native* listener for
    // preventDefault() to actually take effect — React's onTouchMove prop
    // registers a passive listener, which silently ignores
    // preventDefault() (a well-known React/touch gotcha).
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });
    container.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [links, pathname, router]);

  return (
    <div ref={containerRef} className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
      {peek && (
        <div
          ref={peekRef}
          className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-muted"
          style={{ transform: `translateX(${peek.direction === "forward" ? "100%" : "-100%"})` }}
        >
          <PeekCard link={peek.link} />
        </div>
      )}
      <div ref={pageRef} className="relative z-10 bg-background">
        <AnimatedPage key={pathname}>{children}</AnimatedPage>
      </div>
    </div>
  );
}
