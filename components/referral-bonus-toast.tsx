"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Gift } from "lucide-react";

const VISIBLE_MS = 4000;

/**
 * The "you just got a referral bonus" moment — a small toast, not a
 * full-screen takeover like components/brand-splash.tsx (that's reserved
 * for cold-load/just-authenticated, this is a one-off congratulations on
 * top of it). Same ?param-then-strip technique as BrandSplash: `?bonus=1`
 * is appended once, by lib/actions/profile.ts's completeOnboarding, only
 * when redeem_referral actually credited someone (0040_referral_points.sql)
 * — never replayed on refresh/back since the param is stripped after
 * showing.
 */
export function ReferralBonusToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const bonus = searchParams.get("bonus") === "1";

  // dismissed starts false on every mount (server and client agree, no
  // hydration mismatch) — same derivation BrandSplash uses for its own
  // `visible`, just without the "|| !dismissed" half, since this toast
  // should only ever show when ?bonus=1 is actually present, never
  // spontaneously on a plain cold load.
  const [dismissed, setDismissed] = useState(false);
  const visible = bonus && !dismissed;

  const pathnameRef = useRef(pathname);
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    pathnameRef.current = pathname;
    searchParamsRef.current = searchParams;
  });

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setDismissed(true);
      const params = new URLSearchParams(searchParamsRef.current);
      params.delete("bonus");
      const query = params.toString();
      router.replace(query ? `${pathnameRef.current}?${query}` : pathnameRef.current);
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, router]);

  if (!visible) return null;

  return (
    // top-16, not top-4: components/navbar.tsx's sticky header is ~56-57px
    // tall — at top-4 this sat on top of it, covering the notification
    // bell and account menu (unreachable, not just visually crowded) for
    // this toast's whole 4s — same overlap bug class as the FAB/tab-bar
    // fix earlier. Sits just below the header instead.
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[90] flex justify-center px-4">
      <div
        className="pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg"
        style={{ background: "var(--gradient-brand)" }}
      >
        <Gift className="h-4 w-4 shrink-0" />
        +50 points — thanks for joining with an invite!
      </div>
    </div>
  );
}
