"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Portal } from "@/components/portal";
import { cn } from "@/lib/utils";

export type MessageMenuItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  destructive?: boolean;
};

const ITEM_HEIGHT = 40; // px, must match the button's own py/line-height below
const MENU_WIDTH = 176; // 11rem

/**
 * The "⋯" trigger on a message bubble — replaces what used to be a bare
 * unsend button that was `opacity-0 group-hover:opacity-100` (hover-only,
 * confirmed live to be completely invisible/unusable on a touch device:
 * no visible way to unsend a message from a phone). This button has no
 * hover-gate on its own visibility — just a lower resting opacity that
 * brightens on hover as a desktop nicety — so it's always there to tap.
 *
 * Rendered via components/portal.tsx and positioned in viewport
 * coordinates from the trigger's own getBoundingClientRect(), same as
 * components/post-lightbox.tsx's own fixed-overlay approach — required
 * because components/swipe-navigator.tsx wraps page content in a CSS
 * transform, and any transformed ancestor becomes a new containing block
 * for `position: fixed` descendants (the exact bug Portal exists to
 * dodge), and separately because this trigger sits inside the message
 * list's `overflow-y-auto`, which would clip a plain `absolute` popover
 * anchored inside it.
 *
 * Dismissed via a `pointerdown` listener on `document` (not a backdrop
 * div — components/new-chat-picker.tsx's header comment documents why a
 * backdrop portaled to <body> previously ate clicks meant for page
 * content under swipe-navigator's own stacking context) plus Escape. The
 * trigger and the portaled menu are two separate DOM subtrees once open,
 * so both refs are checked, not just one.
 */
export function MessageActionMenu({
  items,
  align,
}: {
  items: MessageMenuItem[];
  /** "end" for own (right-aligned) bubbles, "start" for others'. */
  align: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = items.length * ITEM_HEIGHT + 8;
    const top =
      window.innerHeight - rect.bottom >= menuHeight + 8
        ? rect.bottom + 4
        : Math.max(8, rect.top - menuHeight - 4);
    const left =
      align === "end"
        ? Math.max(8, rect.right - MENU_WIDTH)
        : Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8);
    setPosition({ top, left });
    setOpen(true);
  }

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label="Message actions"
        title="Message actions"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-60 hover:bg-muted hover:opacity-100"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && position && (
        <Portal>
          <div
            ref={menuRef}
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed z-50 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-md"
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 px-3 text-left text-sm hover:bg-muted",
                  item.destructive ? "text-destructive" : "text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </div>
        </Portal>
      )}
    </>
  );
}
