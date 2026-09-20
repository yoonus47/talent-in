"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

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
 * rendered toggle buttons always agree and flip together.
 */
export function useThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { isDark, toggle: () => setDark(!isDark) };
}

/**
 * The header's dark-mode icon button — lives in components/navbar.tsx's
 * icon cluster, next to NotificationBell, on both the desktop and mobile
 * layouts (Navbar renders one header for both, on every route including
 * /chat/*, since only the mobile bottom tab bar hides there — see
 * components/nav-links.tsx). Used to be a `fixed` floating circle
 * instead; moved in-flow so it stops competing with ChatFabButton and the
 * mobile bottom tab bar for the same screen-bottom real estate. That move
 * also made components/chat-composer.tsx's own inline copy (previously
 * needed because the floating button used to hide itself inside an open
 * chat thread) redundant, so it was removed — this header button is
 * always on screen there now too.
 */
export function ThemeToggleButton() {
  const { isDark, toggle } = useThemeToggle();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
