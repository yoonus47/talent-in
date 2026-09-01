"use client";

import { Trash2 } from "lucide-react";
import { deletePost } from "@/lib/actions/posts";

export function DeletePostButton({ postId }: { postId: string }) {
  return (
    <form
      action={deletePost.bind(null, postId)}
      onSubmit={(e) => {
        if (!confirm("Delete this post? This can't be undone.")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        aria-label="Delete post"
        title="Delete post"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  );
}
