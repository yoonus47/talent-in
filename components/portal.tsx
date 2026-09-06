"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// "Has the client mounted yet" never changes after it becomes true, so
// there's nothing to subscribe to — same useSyncExternalStore idiom
// components/theme-toggle.tsx uses for its own server-renders-false,
// client-reconciles-true value.
function subscribe() {
  return () => {};
}
function getSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

/**
 * Renders children directly into document.body instead of wherever this
 * sits in the component tree. Needed for any `fixed` full-screen overlay
 * used from within page content: components/swipe-navigator.tsx applies
 * a CSS `transform` to the page wrapper it drags for the swipe gesture,
 * and per the CSS spec, *any* ancestor with a transform — even an
 * identity one like translateX(0), which the wrapper always has, not
 * just mid-drag — creates a new containing block for `position: fixed`
 * descendants. That silently turns "fixed to the viewport" into "fixed
 * to that ancestor's own (possibly much taller, scrolled-away) box"
 * instead, which is exactly what made components/post-lightbox.tsx get
 * stuck showing a black overlay that didn't line up with the visible
 * screen. A portal escapes the DOM hierarchy entirely (React still
 * treats it as a normal child for props/context/event bubbling — only
 * its actual DOM position changes), sidestepping the problem regardless
 * of what any ancestor's CSS does.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
