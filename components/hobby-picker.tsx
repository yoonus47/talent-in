"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { HOBBY_CATEGORIES, MAX_HOBBIES } from "@/lib/hobbies";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Categorized, searchable hobby checkbox picker — plain `name="interests"`
 * checkboxes under the hood, so it drops into any existing server-action
 * form (onboarding, settings) with no extra wiring. Categories collapse by
 * default (native <details>, no JS needed for that part) and auto-expand
 * to reveal matches while searching.
 */
export function HobbyPicker({ defaultSelected = [] }: { defaultSelected?: string[] }) {
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(defaultSelected.length);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HOBBY_CATEGORIES;
    return HOBBY_CATEGORIES.map((c) => ({
      ...c,
      hobbies: c.hobbies.filter((h) => h.toLowerCase().includes(q)),
    })).filter((c) => c.hobbies.length > 0);
  }, [query]);

  function handleChange() {
    const checked = containerRef.current?.querySelectorAll("input:checked").length ?? 0;
    setCount(checked);
  }

  const atLimit = count >= MAX_HOBBIES;

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hobbies…"
            className="pl-9"
          />
        </div>
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            atLimit ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {count}/{MAX_HOBBIES} selected
        </span>
      </div>

      <div
        ref={containerRef}
        onChange={handleChange}
        className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-border p-1"
      >
        {filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No hobbies match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          filtered.map((category) => (
            <details
              key={category.name}
              {...(query ? { open: true } : {})}
              className="rounded-md"
            >
              <summary className="cursor-pointer list-none rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                {category.name}
              </summary>
              <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
                {category.hobbies.map((hobby) => {
                  const isChecked = defaultSelected.includes(hobby);
                  return (
                    <label
                      key={hobby}
                      className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary has-disabled:cursor-not-allowed has-disabled:opacity-40"
                    >
                      <input
                        type="checkbox"
                        name="interests"
                        value={hobby}
                        defaultChecked={isChecked}
                        disabled={!isChecked && atLimit}
                        className="sr-only"
                      />
                      {hobby}
                    </label>
                  );
                })}
              </div>
            </details>
          ))
        )}
      </div>
    </div>
  );
}
