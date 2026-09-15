"use client";

import { useState, useTransition } from "react";
import { createCommunityReply } from "@/lib/actions/community";

/** Reply box at the bottom of a thread — mirrors MentionInput's simpler
 * parts (client-owned value, clears on submit, useTransition pending
 * state) minus the mention autocomplete — community has no mentions in
 * v1 (see 0028_community.sql's header comment). */
export function CommunityReplyComposer({ threadId }: { threadId: string }) {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (value.trim().length === 0 || isPending) return;
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createCommunityReply(threadId, formData);
      setValue("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <textarea
        name="content"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a reply…"
        rows={2}
        maxLength={1000}
        disabled={isPending}
        className="flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isPending || value.trim().length === 0}
        className="h-10 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
      >
        {isPending ? "…" : "Reply"}
      </button>
    </form>
  );
}
