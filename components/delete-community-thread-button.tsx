"use client";

import { X } from "lucide-react";
import { deleteCommunityThread } from "@/lib/actions/community";
import { cn } from "@/lib/utils";

/** Mirrors components/delete-comment-button.tsx. */
export function DeleteCommunityThreadButton({
  threadId,
  className,
}: {
  threadId: string;
  className?: string;
}) {
  return (
    <form
      action={deleteCommunityThread.bind(null, threadId)}
      onSubmit={(e) => {
        if (!confirm("Delete this thread? This can't be undone.")) e.preventDefault();
      }}
      className={cn("shrink-0", className)}
    >
      <button
        type="submit"
        aria-label="Delete thread"
        title="Delete thread"
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
