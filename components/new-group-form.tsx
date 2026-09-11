"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { createGroupConversation } from "@/lib/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Profile } from "@/lib/types/database";

const MAX_MEMBERS = 50;

/** Name + mutual-follow multi-select for creating a group — the picker
 * list itself reuses the same candidates create_group_conversation
 * validates against server-side (mutual follow, 0019_group_chats.sql), so
 * a selection made here can only ever fail on the name or the 50-member
 * cap, never on who's selectable. */
export function NewGroupForm({ candidates }: { candidates: Profile[] }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_MEMBERS) next.add(id);
      return next;
    });
  }

  function handleCreate() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give your group a name.");
      return;
    }
    if (selected.size === 0) {
      setError("Add at least one other person.");
      return;
    }
    startTransition(async () => {
      const result = await createGroupConversation(trimmed, [...selected]);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Group name"
        maxLength={60}
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <Card className="max-h-96 divide-y divide-border overflow-y-auto p-0">
        {candidates.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Follow each other with someone to add them to a group.
          </p>
        ) : (
          candidates.map((p) => {
            const isSelected = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
              >
                <Avatar name={p.full_name} src={p.avatar_url} size={40} />
                <span className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium text-foreground">{p.full_name}</span>{" "}
                  <span className="text-muted-foreground">@{p.username}</span>
                </span>
                <span
                  className={
                    isSelected
                      ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                      : "h-5 w-5 shrink-0 rounded-full border border-border"
                  }
                >
                  {isSelected && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })
        )}
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selected.size} / {MAX_MEMBERS} selected
        </p>
        <Button type="button" onClick={handleCreate} disabled={isPending}>
          {isPending ? "Creating…" : "Create group"}
        </Button>
      </div>
    </div>
  );
}
