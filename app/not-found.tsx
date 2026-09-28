import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

/**
 * Root 404 — since Next 13.3, app/not-found.tsx handles both an explicit
 * notFound() call from any page (e.g. a blocked/missing profile, see
 * app/profile/[username]/page.tsx) and any unmatched URL app-wide, so
 * this one file covers both without a separate global-not-found.js.
 * Renders inside the root layout, same as any other page — normal
 * theming/Tailwind applies, unlike app/global-error.tsx.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg items-center px-4">
      <Card className="animate-fade-up w-full p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link href="/feed" className={buttonVariants({ className: "mt-6" })}>
          Back to feed
        </Link>
      </Card>
    </div>
  );
}
