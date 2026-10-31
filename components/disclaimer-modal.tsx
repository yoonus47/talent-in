"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { acceptDisclaimer } from "@/lib/actions/profile";
import { Card } from "@/components/ui/card";

// Flip to false once this ships for real: true means every login shows
// this again regardless of disclaimer_accepted_at — exactly what's
// wanted during testing (catch every tester, every session, since the
// text itself is still being iterated on), not what's wanted after
// launch (show once, ever, at first use).
const ALWAYS_SHOW = true;

const POINTS = [
  "This is experimental, actively-being-built software. Expect rough edges, sudden changes, and the occasional bug.",
  "We can't promise the app is always available, error-free, or that nothing you post or save will ever be lost.",
  "Nothing here is professional career, legal, or mental health advice. For big decisions, talk to a parent, teacher, or counselor.",
  "Be kind, keep it appropriate, and never share personal details you wouldn't want strangers to see.",
  "By continuing, you agree the app is provided “as is” during this testing period and accept our Terms & Privacy Policy.",
];

/**
 * Pre-launch legal disclaimer gate — a blocking, non-dismissable overlay
 * (no backdrop-click, no Escape) shown to a logged-in user until they
 * explicitly accept. Rendered once from app/layout.tsx, same mount point
 * as components/brand-splash.tsx, but this one is a real gate, not a
 * timed-out moment: it has no auto-dismiss timer at all.
 *
 * `ALWAYS_SHOW` above is the one toggle this whole feature hangs off of —
 * see its own comment.
 */
export function DisclaimerModal({ alreadyAccepted }: { alreadyAccepted: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);
  const visible = !dismissed && (ALWAYS_SHOW || !alreadyAccepted);

  if (!visible) return null;

  async function handleAccept() {
    setPending(true);
    // Optimistic: this is a courtesy/legal gate, not a security boundary
    // — a failed write just means it shows again next time, so there's
    // no reason to make the user wait on the round trip to move on.
    setDismissed(true);
    await acceptDisclaimer();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <Card className="animate-fade-up w-full max-w-md p-6 sm:p-8">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          <FlaskConical className="h-7 w-7" />
        </div>

        <h1 className="mt-4 text-center text-xl font-bold text-foreground">Before you dive in</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          TalentZify is still being built, out in the open. Here&apos;s the quick version of
          what that means for you right now.
        </p>

        <ul className="mt-5 space-y-3 rounded-xl border border-border bg-muted p-4 text-sm text-foreground">
          {POINTS.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleAccept}
          disabled={pending}
          className="mt-6 flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--gradient-brand)" }}
        >
          I understand, let&apos;s go
        </button>
      </Card>
    </div>
  );
}
