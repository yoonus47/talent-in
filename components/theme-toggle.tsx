"use client";

import { useSyncExternalStore } from "react";

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
