"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "talentzify-theme";
const THEME_EVENT = "talentzify-theme-change";

function subscribe(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

function getSnapshot() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

// Server always renders light (the default); the no-flash script in
// app/layout.tsx sets the attribute before hydration if dark was stored,
// and useSyncExternalStore reconciles the mismatch on mount automatically.
function getServerSnapshot() {
  return false;
}

function setDark(dark: boolean) {
  if (dark) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  window.dispatchEvent(new Event(THEME_EVENT));
}

/**
 * Shared toggle state: the DOM attribute + localStorage + a custom event
 * ARE the store, not any single component's own state — so any number of
 * rendered toggle buttons (the floating one, plus the inline one in
 * components/chat-thread.tsx) always agree and flip together.
 */
export function useThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { isDark, toggle: () => setDark(!isDark) };
}

/**
 * The floating dark-mode button. Hidden on mobile specifically while
 * inside an open chat thread (not the conversation list — that one's
 * fine): a `fixed` element can't reliably track where "the bottom" is
 * while iOS Safari's on-screen keyboard is animating the visual viewport,
 * which is what kept leaving it visibly misaligned with the composer's
 * Send button there. components/chat-thread.tsx renders its own static,
 * in-flow copy next to Send instead — same shared toggle state, just laid
 * out in the normal flex row so it can't ever drift out of alignment.
 */
export function ThemeToggle() {
  const { isDark, toggle } = useThemeToggle();
  const pathname = usePathname();
  const hideOnMobile = pathname.startsWith("/chat/");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg hover:bg-muted",
        hideOnMobile && "hidden sm:flex",
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
