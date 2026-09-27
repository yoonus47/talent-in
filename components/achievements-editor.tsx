"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Award, Camera, Pencil, Plus, Trash2 } from "lucide-react";
import { addAchievement, deleteAchievement, updateAchievement } from "@/lib/actions/achievements";
import { validateImageFile } from "@/lib/uploads";
import { isHeicFile, convertToJpeg, setInputFile } from "@/lib/image-client";
import { MAX_ACHIEVEMENTS } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { joinedDate } from "@/lib/utils";
import type { Achievement } from "@/lib/types/database";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** The add/edit form — one component for both, since they're identical
 * apart from what's pre-filled. Not a plain <form action={fn}>, unlike
 * every other Settings sub-form: this needs to close itself (setEditing
 * back to null) only once the save actually succeeds, which means calling
 * the server action directly from onSubmit and awaiting its result rather
 * than letting a redirect drive the outcome — see achievements.ts's own
 * comment on why those actions return { error } instead of redirecting. */
function AchievementForm({
  achievement,
  onSaved,
  onCancel,
}: {
  achievement: Achievement | "new";
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isNew = achievement === "new";
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const existingImage = isNew ? null : achievement.image_url;
  const shown = preview ?? existingImage;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    let file = e.target.files?.[0];
    setImageError(null);
    if (!file) {
      setPreview(null);
      return;
    }
    if (isHeicFile(file)) {
      setConverting(true);
      try {
        file = await convertToJpeg(file);
        if (inputRef.current) setInputFile(inputRef.current, file);
      } catch {
        setConverting(false);
        setImageError("Couldn't read that iPhone photo format. Try a different one.");
        setPreview(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      setConverting(false);
    }
    const validationError = validateImageFile(file, MAX_IMAGE_BYTES);
    if (validationError) {
      setImageError(validationError);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const formData = new FormData(e.currentTarget);
    const result = isNew
      ? await addAchievement(formData)
      : await updateAchievement(achievement.id, formData);
    setSaving(false);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="ach-title">Title</Label>
        <Input
          id="ach-title"
          name="title"
          required
          maxLength={120}
          placeholder="1st place, State Science Fair"
          defaultValue={isNew ? "" : achievement.title}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ach-issuer">Issuer</Label>
          <Input
            id="ach-issuer"
            name="issuer"
            maxLength={120}
            placeholder="CBSE Regional, Coursera…"
            defaultValue={isNew ? "" : (achievement.issuer ?? "")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ach-date">When</Label>
          <Input
            id="ach-date"
            name="earnedOn"
            type="month"
            defaultValue={isNew ? "" : (achievement.earned_on?.slice(0, 7) ?? "")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ach-description">Description</Label>
        <Textarea
          id="ach-description"
          name="description"
          maxLength={280}
          placeholder="A sentence about what this was."
          defaultValue={isNew ? "" : (achievement.description ?? "")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ach-url">Credential link</Label>
        <Input
          id="ach-url"
          name="credentialUrl"
          type="url"
          placeholder="https://coursera.org/verify/..."
          defaultValue={isNew ? "" : (achievement.credential_url ?? "")}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Photo</Label>
        <div className="flex items-center gap-3">
          {shown && (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border">
              <Image src={shown} alt="" fill sizes="56px" className="object-cover" />
            </div>
          )}
          <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <Camera className="mr-1.5 inline h-4 w-4" />
            {converting ? "Processing…" : shown ? "Change photo" : "Add photo"}
            <input
              ref={inputRef}
              type="file"
              name="image"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              onChange={handleFileChange}
              disabled={converting}
              className="sr-only"
            />
          </label>
        </div>
        {imageError && <p className="text-xs text-destructive">{imageError}</p>}
      </div>

      {formError && <p className="text-xs text-destructive">{formError}</p>}

      <div className="flex items-center gap-2 pt-1">
        <Button type="submit" size="sm" disabled={saving || converting}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AchievementRow({
  achievement,
  onEdit,
}: {
  achievement: Achievement;
  onEdit: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Remove this achievement?")) return;
    setDeleting(true);
    await deleteAchievement(achievement.id);
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
      {achievement.image_url ? (
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-border">
          <Image src={achievement.image_url} alt="" fill sizes="44px" className="object-cover" />
        </div>
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Award className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{achievement.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[achievement.issuer, achievement.earned_on ? joinedDate(achievement.earned_on) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label="Delete"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function AchievementsEditor({ achievements }: { achievements: Achievement[] }) {
  const [editing, setEditing] = useState<Achievement | "new" | null>(null);
  const atCap = achievements.length >= MAX_ACHIEVEMENTS;

  return (
    <div className="space-y-2">
      {achievements.map((achievement) =>
        editing !== "new" && editing?.id === achievement.id ? (
          <AchievementForm
            key={achievement.id}
            achievement={achievement}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <AchievementRow key={achievement.id} achievement={achievement} onEdit={() => setEditing(achievement)} />
        ),
      )}

      {editing === "new" && (
        <AchievementForm achievement="new" onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
      )}

      {editing === null &&
        (atCap ? (
          <p className="text-xs text-muted-foreground">
            {MAX_ACHIEVEMENTS}/{MAX_ACHIEVEMENTS}. Remove one to add another.
          </p>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" />
            Add achievement
          </Button>
        ))}
    </div>
  );
}
