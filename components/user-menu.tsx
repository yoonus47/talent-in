"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, Moon, Settings, Sun } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { useThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * The navbar's avatar button — Gmail's own account-switcher pattern:
 * tapping the avatar opens a small anchored card (name/username up top,
 * then account-level actions below) instead of scattering those actions
 * as their own separate icons along the header. Replaces what used to be
 * three separate elements there (a floating ThemeToggle, a plain Avatar
 * link to /settings, a bare "Log out" text button) — collapsing them into
 * one trigger is also what fixes the header's own resize bugs: those
 * three elements plus 5 nav pills had no slack left in the header's
 * "won't wrap, won't shrink" row at in-between (tablet) widths.
 * NotificationBell stays its own icon outside this menu, same as Gmail
 * keeps its own notification/apps icons separate from the profile menu —
 * it's a link to a page, not an account-level toggle.
 *
 * No Portal here (unlike components/message-action-menu.tsx, which needs
 * one): Navbar sits outside components/swipe-navigator.tsx's transformed
 * page wrapper entirely, and the header has no overflow-hidden ancestor
 * to clip a plain `absolute` popover — the complexity Portal exists for
 * just doesn't apply at this call site.
 */
export function UserMenu({
  fullName,
  username,
  avatarUrl,
}: {
  fullName: string;
  username: string;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isDark, toggle } = useThemeToggle();

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function close() {
    setMounted(false);
    setTimeout(() => setOpen(false), 150);
  }

  const itemClass =
    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label="Account menu"
        aria-expanded={open}
        className="block rounded-full transition-shadow hover:ring-2 hover:ring-border"
      >
        <Avatar name={fullName} src={avatarUrl} size={32} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-border bg-card shadow-lg transition-all duration-150",
            mounted ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          <div className="flex items-center gap-3 p-4">
            <Avatar name={fullName} src={avatarUrl} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
              <p className="truncate text-xs text-muted-foreground">@{username}</p>
            </div>
          </div>

          <div className="border-t border-border py-1">
            <Link href="/settings" onClick={close} className={itemClass}>
              <Settings className="h-4 w-4 text-muted-foreground" />
              Settings
            </Link>
            <button type="button" onClick={() => { toggle(); close(); }} className={itemClass}>
              {isDark ? (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
              {isDark ? "Switch to light mode" : "Switch to dark mode"}
            </button>
          </div>

          <div className="border-t border-border py-1">
            <form action={signOut}>
              <button type="submit" className={itemClass}>
                <LogOut className="h-4 w-4 text-muted-foreground" />
                Log out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
