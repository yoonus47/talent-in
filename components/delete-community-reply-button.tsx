"use client";

import { X } from "lucide-react";
import { deleteCommunityReply } from "@/lib/actions/community";
import { cn } from "@/lib/utils";

/** Mirrors components/delete-comment-button.tsx. */
export function DeleteCommunityReplyButton({
  replyId,
  threadId,
  className,
}: {
  replyId: string;
  threadId: string;
  className?: string;
}) {
  return (
    <form
      action={deleteCommunityReply.bind(null, replyId, threadId)}
      onSubmit={(e) => {
        if (!confirm("Delete this reply? This can't be undone.")) e.preventDefault();
      }}
      className={cn("shrink-0", className)}
    >
      <button
        type="submit"
        aria-label="Delete reply"
        title="Delete reply"
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
