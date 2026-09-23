import { cn } from "@/lib/utils";

// Bump this by hand alongside real release milestones — no build-time
// version injection exists yet, and this is a small enough surface that
// wiring one up isn't worth it until the app actually needs it elsewhere
// too (release notes, support requests, etc).
const APP_VERSION = "0.3.51";

/**
 * A deliberately quiet "this is early software" marker — muted-foreground,
 * no bold, no brand color (see the gradient-restraint memory: this app's
 * one saturated treatment is reserved for rare moments, not an
 * always-visible element). The full sentence, always rendered as real
 * text rather than a hover-only tooltip — on a mobile-first app most
 * viewers never trigger a `title` attribute at all.
 *
 * No `whitespace-nowrap` and `min-w-0` included on purpose: at mobile
 * widths (components/navbar.tsx's middle slot) there isn't room for this
 * full sentence on one line, so it's allowed to wrap to two — min-w-0
 * is what lets it actually shrink and wrap instead of overflowing its
 * flex container, the same fix this app's had to apply repeatedly
 * elsewhere for exactly this flex/overflow pattern.
 */
export function VersionBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "select-none min-w-0 rounded-full border border-border px-2.5 py-1 text-center text-[10px] leading-snug font-normal text-muted-foreground/80",
        className,
      )}
    >
      Alpha v{APP_VERSION} · developer preview
    </span>
  );
}

/**
 * The desktop-only counterpart (app/layout.tsx's fixed bottom-left
 * watermark) — bigger type (15px, ~50% up from the mobile badge's 10px)
 * and a second line spelling out what "alpha" actually means, since
 * there's room for it there and none in the mobile navbar's tight gap.
 * A card, not a pill, now that it's two differently-sized lines rather
 * than one short one.
 */
export function DesktopVersionBadge({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "select-none rounded-lg border border-border bg-card/90 px-3 py-2 backdrop-blur-sm",
        className,
      )}
    >
      <p className="text-[15px] font-normal leading-tight text-muted-foreground/80">
        Alpha v{APP_VERSION} · developer preview
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/60">
        Early build. Features may be incomplete or change without notice.
      </p>
    </div>
  );
}
