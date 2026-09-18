"use client";

import { useState, useTransition } from "react";
import { ListPlus, X } from "lucide-react";
import { createCommunityThread } from "@/lib/actions/community";
import { PostImagePicker } from "@/components/post-image-picker";
import { Button } from "@/components/ui/button";
import type { CommunityTopic } from "@/lib/types/database";

const fieldClass =
  "block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const MAX_POLL_OPTIONS = 6;

/** Topic + title + body — mirrors components/new-group-form.tsx's shape
 * (client-owned fields, useTransition, surfaces the Server Action's
 * `{error}` return). createCommunityThread redirects into the new thread
 * on success, same as createGroupConversation does on success — nothing
 * else to do here in that case.
 *
 * Also: an anonymous-posting checkbox, components/post-image-picker.tsx
 * dropped in as-is (already fully generic — a `name="image"` file input
 * plus hidden imageWidth/imageHeight fields, no post-specific coupling to
 * adapt), and an optional poll (2-6 "pollOption" text fields, read via
 * formData.getAll on the server — see createCommunityThread).
 */
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
  // [] means "no poll" — the "Add a poll" button seeds two empty rows;
  // dropping back down to 0 (removing every row) silently cancels it
  // again, same as never having added one (createCommunityThread already
  // ignores anything under 2 non-empty labels).
  const [pollOptions, setPollOptions] = useState<string[]>([]);
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

      <PostImagePicker />

      {pollOptions.length === 0 ? (
        <button
          type="button"
          onClick={() => setPollOptions(["", ""])}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ListPlus className="h-4 w-4" />
          Add a poll
        </button>
      ) : (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Poll options</p>
          {pollOptions.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                name="pollOption"
                value={value}
                onChange={(e) =>
                  setPollOptions((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                }
                placeholder={`Option ${i + 1}`}
                maxLength={80}
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove option"
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {pollOptions.length < MAX_POLL_OPTIONS && (
            <button
              type="button"
              onClick={() => setPollOptions((prev) => [...prev, ""])}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Add option
            </button>
          )}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" name="isAnonymous" className="h-4 w-4 rounded border-border" />
        Post anonymously
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending || !title.trim() || !body.trim() || !topicId}>
        {isPending ? "Posting…" : "Post thread"}
      </Button>
    </form>
  );
}
