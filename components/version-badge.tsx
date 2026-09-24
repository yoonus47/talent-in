import { cn } from "@/lib/utils";

// Bump this by hand alongside real release milestones — no build-time
// version injection exists yet, and this is a small enough surface that
// wiring one up isn't worth it until the app actually needs it elsewhere
// too (release notes, support requests, etc).
export const APP_VERSION = "0.3.57";

/**
 * A deliberately quiet "this is early software" marker — muted-foreground,
 * no bold, no brand color (see the gradient-restraint memory: this app's
 * one saturated treatment is reserved for rare moments, not an
 * always-visible element). One shared subtle style for both call sites
 * (components/navbar.tsx's mobile middle-gap pill, and app/layout.tsx's
 * desktop bottom-left watermark) — a separate bigger/louder desktop
 * treatment existed briefly but read as too loud, so both are back to
 * this same text weight/size, just with different copy passed as
 * children (desktop has room for a longer explanatory sentence, the
 * mobile navbar gap doesn't).
 *
 * No `whitespace-nowrap` and `min-w-0` included on purpose: text is
 * allowed to wrap rather than overflow its flex container — the same fix
 * this app's had to apply repeatedly elsewhere for exactly this pattern.
 */
export function VersionBadge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "select-none min-w-0 rounded-full border border-border px-2.5 py-1 text-center text-[10px] leading-snug font-normal text-muted-foreground/80",
        className,
      )}
    >
      {children}
    </span>
  );
}
