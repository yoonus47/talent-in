import type { Viewport } from "next";

/**
 * Without this, mobile browsers only resize the *visual* viewport when
 * the on-screen keyboard opens — the layout viewport (what `dvh` units in
 * components/chat-thread.tsx measure against) stays the same size, so a
 * dvh-bounded container doesn't actually shrink to make room for the
 * keyboard the way it looks like it should. `resizes-content` makes the
 * browser shrink the real layout viewport instead, which is what lets the
 * message list/composer reflow correctly above the keyboard (and back
 * down when it's dismissed) instead of needing a manual pan to reach it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
