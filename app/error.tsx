"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary — catches anything that throws while rendering a
 * page or component (not the root layout itself, see app/global-error.tsx
 * for that). Error boundaries must be Client Components.
 *
 * This build's error.js takes `{ error, retry }`, not the `{ error,
 * reset }` shape from older Next.js docs/training data — `retry` went
 * stable in 16.3 (this project's version); confirmed against
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * error.md per this repo's own AGENTS.md instruction to check docs before
 * writing code here, since this is not the Next.js you know.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg items-center px-4">
      <Card className="animate-fade-up w-full p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That&apos;s on us, not you. Give it another try.
        </p>
        <Button className="mt-6" onClick={() => retry()}>
          Try again
        </Button>
      </Card>
    </div>
  );
}
