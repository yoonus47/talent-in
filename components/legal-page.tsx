import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/ui/card";

/**
 * Shared chrome for /terms and /privacy — a plain, readable document
 * layout (not the "vibe" treatment components/disclaimer-modal.tsx gets,
 * on purpose: these are the actual instrument the modal's acceptance
 * points at, so legibility matters more than personality here). The
 * draft banner is load-bearing, not decorative: neither page's text has
 * had real legal review yet, and this should stay visible until that
 * changes.
 */
export function LegalPage({
  title,
  lastUpdated,
  otherDocHref,
  otherDocLabel,
  children,
}: {
  title: string;
  lastUpdated: string;
  otherDocHref: string;
  otherDocLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <BackLink fallbackHref="/" aria-label="Back">
        <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
      </BackLink>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <span className="shrink-0 rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-destructive">
          Draft
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Last updated {lastUpdated}</p>

      <Card className="mt-5 flex items-start gap-2.5 border-destructive/20 bg-destructive/5 p-4 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <p>
          This is a placeholder draft, written for internal testing while TalentZify is still
          being built. It has not been reviewed by a lawyer, is not final, and should not be
          relied on as the actual legal terms of the Service yet.
        </p>
      </Card>

      <div className="mt-7 space-y-7">{children}</div>

      <div className="mt-10 space-y-2 border-t border-border pt-6 text-sm text-muted-foreground">
        <p>
          See also our{" "}
          <Link href={otherDocHref} className="font-medium text-primary hover:underline">
            {otherDocLabel}
          </Link>
          .
        </p>
        <p>
          Questions? Reach us at{" "}
          <span className="font-medium text-foreground">[contact email]</span>.
        </p>
      </div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-foreground">{heading}</h2>
      <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
