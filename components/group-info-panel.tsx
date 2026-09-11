"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil, UserMinus, UserPlus, X } from "lucide-react";
import {
  addGroupMembers,
  leaveGroup,
  removeGroupMember,
  renameGroupConversation,
} from "@/lib/actions/chat";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GroupMember } from "@/lib/data";
import type { Profile } from "@/lib/types/database";

const MAX_MEMBERS = 100;

export function GroupInfoPanel({
  conversationId,
  groupInfo,
  viewerId,
  isAdmin,
  addableCandidates,
}: {
  conversationId: string;
  groupInfo: { id: string; name: string; members: GroupMember[] };
  viewerId: string;
  isAdmin: boolean;
  addableCandidates: Profile[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(groupInfo.name);
  const [error, setError] = useState<string | null>(null);

  const [addingMembers, setAddingMembers] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Group name can't be empty.");
      return;
    }
    startTransition(async () => {
      const result = await renameGroupConversation(conversationId, trimmed);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setEditingName(false);
      router.refresh();
    });
  }

  function handleRemove(memberId: string) {
    if (!confirm("Remove this person from the group?")) return;
    startTransition(async () => {
      await removeGroupMember(conversationId, memberId);
      router.refresh();
    });
  }

  function handleLeave() {
    if (!confirm("Leave this group? You'll need to be re-added to come back.")) return;
    startTransition(async () => {
      await leaveGroup(conversationId);
    });
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size + groupInfo.members.length < MAX_MEMBERS) next.add(id);
      return next;
    });
  }

  function handleAddMembers() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const result = await addGroupMembers(conversationId, [...selected]);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setSelected(new Set());
      setAddingMembers(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href={`/chat/${conversationId}`} aria-label="Back to chat">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </Link>
        <h1 className="text-lg font-bold">Group info</h1>
      </div>

      <Card className="space-y-2 p-4">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="button" size="sm" onClick={saveName} disabled={isPending}>
              Save
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-semibold text-foreground">{groupInfo.name}</span>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                aria-label="Rename group"
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </Card>

      <Card className="divide-y divide-border p-0">
        {groupInfo.members.map((member) => (
          <div key={member.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={member.full_name} src={member.avatar_url} size={40} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {member.full_name}
              {member.id === viewerId && <span className="text-muted-foreground"> (you)</span>}
            </span>
            {member.role === "admin" && <Badge variant="accent">Admin</Badge>}
            {isAdmin && member.id !== viewerId && (
              <button
                type="button"
                onClick={() => handleRemove(member.id)}
                aria-label={`Remove ${member.full_name}`}
                title="Remove from group"
                className="text-muted-foreground hover:text-destructive"
              >
                <UserMinus className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </Card>

      {isAdmin && (
        <Card className="p-4">
          {!addingMembers ? (
            <button
              type="button"
              onClick={() => setAddingMembers(true)}
              className="flex items-center gap-2 text-sm font-medium text-primary"
            >
              <UserPlus className="h-4 w-4" />
              Add members
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Add members</p>
                <button
                  type="button"
                  onClick={() => setAddingMembers(false)}
                  aria-label="Cancel"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {addableCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Everyone you mutually follow is already in this group.
                </p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {addableCandidates.map((p) => {
                    const isSelected = selected.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => toggleSelected(p.id)}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted/50"
                      >
                        <Avatar name={p.full_name} src={p.avatar_url} size={32} />
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
                  })}
                </div>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleAddMembers}
                disabled={selected.size === 0 || isPending}
              >
                Add {selected.size > 0 ? selected.size : ""}
              </Button>
            </div>
          )}
        </Card>
      )}

      <Button type="button" variant="destructive" onClick={handleLeave} disabled={isPending}>
        Leave group
      </Button>
    </div>
  );
}
