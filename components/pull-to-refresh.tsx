"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD = 64; // px of (damped) content shift needed to commit to a refresh
const MAX_PULL = 96; // hard cap regardless of how far the finger travels
const DIRECTION_SLOP = 6; // px of pure downward movement before this claims the gesture
const SNAP_MS = 220;
const MIN_SPINNER_MS = 500; // a refresh that resolves faster than this still holds briefly — an instant flash reads as broken, not fast
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)"; // matches components/swipe-navigator.tsx, for a consistent feel across the app's gesture-driven UI

// Full 1:1 movement up to the trigger point, then heavy resistance past
// it — an iOS-style rubber band, and a physical "you've pulled far
// enough" cue right at the threshold.
function damp(rawDy: number): number {
  if (rawDy <= PULL_THRESHOLD) return rawDy;
  return Math.min(MAX_PULL, PULL_THRESHOLD + (rawDy - PULL_THRESHOLD) * 0.35);
}

type Phase = "idle" | "pulling" | "refreshing";

/**
 * Pull-down-to-refresh for pages whose data can go stale without the user
 * navigating away and back (a server-rendered list with no realtime
 * subscription of its own — see each page's own reason for using this).
 * Same hand-rolled gesture discipline as swipe-navigator.tsx and for the
 * same reason: native non-passive listeners via refs, high-frequency drag
 * updates written straight to the DOM (never React state, which would
 * re-render every touchmove), state reserved for the few *discrete*
 * things that actually need it. The two gesture systems don't need to
 * know about each other — a vertical pull is already rejected cleanly by
 * swipe-navigator's own horizontal-ratio check with no changes needed
 * there, and this only ever arms when already scrolled to the very top,
 * so it never competes with an ordinary scroll either.
 *
 * router.refresh() itself returns void with no way to know when it's
 * done — wrapping it in startTransition and watching that same
 * useTransition's `isPending` is the pattern already established in this
 * codebase (components/group-info-panel.tsx) for exactly that gap.
 */
export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [phase, setPhaseState] = useState<Phase>("idle");

  const contentRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);
  const phaseRef = useRef<Phase>("idle");
  const gesture = useRef<{ startY: number; tracking: boolean } | null>(null);
  const refreshStartedAt = useRef(0);

  // Listeners below are only ever attached once (mount-once, like
  // swipe-navigator.tsx) — phase changes mid-drag go through this so
  // handlers can read the latest value via the ref without the effect
  // having to depend on `phase` and tear down/reinstall mid-gesture.
  function setPhase(next: Phase) {
    phaseRef.current = next;
    setPhaseState(next);
  }

  function paint(px: number, animated: boolean) {
    const transition = animated ? `transform ${SNAP_MS}ms ${EASING}` : "none";
    if (contentRef.current) {
      contentRef.current.style.transition = transition;
      contentRef.current.style.transform = px > 0 ? `translateY(${px}px)` : "";
    }
    if (indicatorRef.current) {
      const shown = Math.min(1, px / PULL_THRESHOLD);
      indicatorRef.current.style.transition = animated
        ? `opacity ${SNAP_MS}ms ${EASING}, transform ${SNAP_MS}ms ${EASING}`
        : "none";
      indicatorRef.current.style.opacity = String(shown);
      indicatorRef.current.style.transform = `translateY(${px - 40}px) scale(${0.6 + 0.4 * shown})`;
    }
    if (iconRef.current && phaseRef.current !== "refreshing") {
      iconRef.current.style.transform = `rotate(${Math.min(180, (px / PULL_THRESHOLD) * 180)}deg)`;
    }
  }

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (phaseRef.current !== "idle") return;
      if ((document.scrollingElement?.scrollTop ?? 0) > 0) return;
      gesture.current = { startY: e.touches[0].clientY, tracking: false };
    }

    function onTouchMove(e: TouchEvent) {
      const state = gesture.current;
      if (!state) return;
      const rawDy = e.touches[0].clientY - state.startY;

      if (!state.tracking) {
        if (rawDy < DIRECTION_SLOP) {
          if (rawDy < 0) gesture.current = null; // moving up — not a pull, bail entirely
          return;
        }
        if ((document.scrollingElement?.scrollTop ?? 0) > 0) {
          // Scrolled away from the top since touchstart (e.g. a fling
          // still settling) — this drag doesn't get to become a pull.
          gesture.current = null;
          return;
        }
        state.tracking = true;
        setPhase("pulling");
      }

      e.preventDefault();
      paint(damp(Math.max(0, rawDy)), false);
    }

    function onTouchEnd(e: TouchEvent) {
      const state = gesture.current;
      gesture.current = null;
      if (!state?.tracking) return;

      // touchend carries no coordinates of its own — changedTouches has
      // the final position of the finger that just lifted.
      const rawDy = (e.changedTouches[0]?.clientY ?? 0) - state.startY;
      const dy = damp(Math.max(0, rawDy));

      if (dy >= PULL_THRESHOLD) {
        paint(PULL_THRESHOLD, true);
        setPhase("refreshing");
        refreshStartedAt.current = Date.now();
        startTransition(() => {
          router.refresh();
        });
      } else {
        paint(0, true);
        setPhase("idle");
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router]);

  useEffect(() => {
    if (phase !== "refreshing" || isPending) return;
    const remaining = Math.max(0, MIN_SPINNER_MS - (Date.now() - refreshStartedAt.current));
    const t = setTimeout(() => {
      paint(0, true);
      setPhase("idle");
    }, remaining);
    return () => clearTimeout(t);
  }, [phase, isPending]);

  return (
    <div className="relative">
      <div
        ref={indicatorRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-3 opacity-0"
        style={{ transform: "translateY(-40px)" }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-sm">
          <Loader2
            ref={iconRef}
            className={cn("h-4 w-4 text-primary", phase === "refreshing" && "animate-spin")}
          />
        </div>
      </div>
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
