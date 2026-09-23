"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Neither value ever changes after mount, so subscribe is a permanent
// no-op — this just reads a browser-only global safely across SSR/
// hydration, same technique components/theme-toggle.tsx uses for
// data-theme (getServerSnapshot returning a fixed default avoids a
// hydration mismatch, since the server can't know either value).
function noopSubscribe() {
  return () => {};
}
function getOrigin() {
  return window.location.origin;
}
function getOriginServer() {
  return "";
}
function getCanShare() {
  return typeof navigator.share === "function";
}
function getCanShareServer() {
  return false;
}

/**
 * The actual link + copy/share UI for /invite. Split into its own client
 * component since the link needs `window.location.origin` (correct in
 * dev/staging/prod alike, no server-side site-url helper needed).
 */
export function ReferralShareCard({ username }: { username: string }) {
  const origin = useSyncExternalStore(noopSubscribe, getOrigin, getOriginServer);
  const canShare = useSyncExternalStore(noopSubscribe, getCanShare, getCanShareServer);
  const [copied, setCopied] = useState(false);

  const link = origin ? `${origin}/r/${username}` : "";
  const displayLink = origin ? `${origin.replace(/^https?:\/\//, "")}/r/${username}` : "";

  function copyLink() {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }

  function shareLink() {
    if (!link) return;
    navigator
      .share({
        title: "Join me on TalentZify",
        text: "Join me on TalentZify — we both get 50 points when you sign up with my link!",
        url: link,
      })
      .catch(() => {});
  }

  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your invite link
      </p>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5">
        <p className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
          {displayLink || " "}
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" onClick={copyLink} variant={copied ? "secondary" : "primary"} className="flex-1">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy link"}
        </Button>
        {canShare && (
          <Button type="button" onClick={shareLink} variant="outline" size="icon" aria-label="Share invite link">
            <Share2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
