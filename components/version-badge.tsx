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
 * always-visible navbar element). Rendered twice in components/navbar.tsx
 * at different spots for the same reason NavLinks itself splits by
 * breakpoint: below `lg` the nav's middle is genuinely empty (nav pills
 * only render at lg+), so this fills it there; at lg+ that space is
 * already taken by the pills, so it sits beside the wordmark instead.
 */
export function VersionBadge({ className }: { className?: string }) {
  return (
    <span
      title="Developer preview build — things may change or break"
      className={cn(
        "select-none whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[10px] font-normal text-muted-foreground/80",
        className,
      )}
    >
      v{APP_VERSION} · alpha
    </span>
  );
}
