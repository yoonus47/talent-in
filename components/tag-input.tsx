"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Free-text tags — unlike components/hobby-picker.tsx, there's no fixed
 * list to pick from (skills are self-declared, not a taxonomy), so this
 * is a real input instead of checkboxes. Each tag renders as its own
 * hidden `<input name={name}>`, so `formData.getAll(name)` on submit
 * picks them all up exactly the same way HobbyPicker's checkboxes already
 * do for `interests` — no extra wiring needed in the form/action.
 */
export function TagInput({
  name,
  defaultValue = [],
  placeholder,
  max,
}: {
  name: string;
  defaultValue?: string[];
  placeholder?: string;
  max?: number;
}) {
  const [tags, setTags] = useState(defaultValue);
  const [draft, setDraft] = useState("");
  const atLimit = max !== undefined && tags.length >= max;

  function commit() {
    const value = draft.trim();
    setDraft("");
    if (!value || atLimit) return;
    if (tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    setTags([...tags, value]);
  }

  function remove(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  return (
    <div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card p-2",
          "focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(tag)}
              aria-label={`Remove ${tag}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </button>
            <input type="hidden" name={name} value={tag} />
          </span>
        ))}
        {!atLimit && (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commit();
              } else if (e.key === "Backspace" && !draft && tags.length > 0) {
                remove(tags[tags.length - 1]);
              }
            }}
            onBlur={commit}
            placeholder={tags.length === 0 ? placeholder : "Add another…"}
            className="min-w-[8ch] flex-1 border-none bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none"
          />
        )}
      </div>
      {max !== undefined && (
        <p className="mt-1 text-xs text-muted-foreground">
          {tags.length}/{max} — press Enter or comma to add
        </p>
      )}
    </div>
  );
}
