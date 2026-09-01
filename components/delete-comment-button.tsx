"use client";

import { X } from "lucide-react";
import { deleteComment } from "@/lib/actions/comments";

export function DeleteCommentButton({ commentId }: { commentId: string }) {
  return (
    <form
      action={deleteComment.bind(null, commentId)}
      onSubmit={(e) => {
        if (!confirm("Delete this comment? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        aria-label="Delete comment"
        title="Delete comment"
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
}
