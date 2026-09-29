"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Sits once in the root layout, so it mounts exactly when the app's whole
// React tree does — a real cold load (typing the URL, a bookmark, a
// manual refresh, or the hard redirect chain Google OAuth lands on) —
// and never again on an in-app <Link>/swipe navigation, since those keep
// the root layout (and this component) mounted rather than remounting
// it. That's deliberate: the user asked for this on "opening the
// website" and right after login, explicitly *not* on swiping between
// Feed and Dashboard (which keeps its own existing slide-in animation,
// see components/swipe-navigator.tsx).
const VISIBLE_MS = 1300;

/**
 * `visible` is `welcome || !dismissed`:
 *  - `dismissed` starts `false` on every mount — server and client agree
 *    on that with no client-only check involved, so there's no hydration
 *    mismatch — meaning every fresh mount (i.e. every hard load) shows
 *    it once, the same way a native app's splash shows on every launch,
 *    not just the first ever. It flips to `true` after the entrance
 *    finishes and then stays that way for the rest of this mounted
 *    instance's life, i.e. the rest of the SPA session.
 *  - `welcome` (from `?welcome=1`) can re-open it even after `dismissed`
 *    is already `true`: appended by every "just authenticated, landing
 *    on /feed" redirect (app/auth/actions.ts's signIn,
 *    app/onboarding/page.tsx, lib/actions/profile.ts's
 *    completeOnboarding). Needed because that redirect is sometimes a
 *    client-side one (a Server Action redirect doesn't remount the root
 *    layout at all) — a plain "did this page just get asked to show it"
 *    flag beats guessing at Next's navigation internals, which is what
 *    went wrong with relying on loading.tsx for this (it fired on every
 *    Feed↔Dashboard swipe too).
 */
export function BrandSplash() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  const [dismissed, setDismissed] = useState(false);
  const visible = welcome || !dismissed;

  // The dismiss timer below only needs to (re)start on the false→true
  // edge of `visible`, not on every path/query change while it's already
  // counting down — refs let its setTimeout read the *current*
  // path/query/welcome when it actually fires, 1.3s from now, without
  // making those values effect dependencies. `welcome` in particular
  // *must* be a ref, not a dependency: it flips true->false the instant
  // the user navigates away from a fresh ?welcome=1 landing (a swipe to
  // another tab, well within this 1.3s window, is exactly that) while
  // `visible` itself stays true (dismissed hasn't fired yet) — with
  // `welcome` in the dependency array, that transition alone cancelled
  // the in-flight timer and started a brand new one, silently extending
  // how long the splash stayed on screen by a random amount depending on
  // how quickly/often the user swiped right after landing. That's what
  // made it look like the splash "sometimes" showed up mid-swipe: it was
  // never re-triggering, just lingering past its intended 1.3s.
  const pathnameRef = useRef(pathname);
  const searchParamsRef = useRef(searchParams);
  const welcomeRef = useRef(welcome);
  useEffect(() => {
    pathnameRef.current = pathname;
    searchParamsRef.current = searchParams;
    welcomeRef.current = welcome;
  });

  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      setDismissed(true);
      if (welcomeRef.current) {
        // Strip the param so a refresh or a Back navigation doesn't
        // replay it.
        const params = new URLSearchParams(searchParamsRef.current);
        params.delete("welcome");
        const query = params.toString();
        router.replace(query ? `${pathnameRef.current}?${query}` : pathnameRef.current);
      }
    }, VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [visible, router]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <span className="brand-gradient-text brand-curtain-wipe text-4xl font-extrabold sm:text-5xl">
        TalentZify
      </span>
    </div>
  );
}
