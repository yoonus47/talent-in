"use client";

import { useState, useTransition } from "react";
import { createCommunityThread } from "@/lib/actions/community";
import { Button } from "@/components/ui/button";
import type { CommunityTopic } from "@/lib/types/database";

const fieldClass =
  "block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Topic + title + body — mirrors components/new-group-form.tsx's shape
 * (client-owned fields, useTransition, surfaces the Server Action's
 * `{error}` return). createCommunityThread redirects into the new thread
 * on success, same as createGroupConversation does on success — nothing
 * else to do here in that case. */
export function NewThreadForm({
  topics,
  defaultTopicId,
}: {
  topics: CommunityTopic[];
  defaultTopicId?: string;
}) {
  const [topicId, setTopicId] = useState(defaultTopicId ?? topics[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createCommunityThread(topicId, formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="topic" className="text-sm font-medium text-foreground">
          Topic
        </label>
        <select
          id="topic"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          className={`mt-1 ${fieldClass}`}
        >
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Give it a title"
        maxLength={120}
        className={fieldClass}
      />

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What's on your mind?"
        rows={6}
        maxLength={3000}
        className={`resize-none ${fieldClass}`}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending || !title.trim() || !body.trim() || !topicId}>
        {isPending ? "Posting…" : "Post thread"}
      </Button>
    </form>
  );
}
