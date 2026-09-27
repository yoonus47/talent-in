"use client";

import { useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { removeAvatar, removeCover, uploadAvatar, uploadCover } from "@/lib/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/submit-button";
import { validateImageFile } from "@/lib/uploads";
import { isHeicFile, convertToJpeg, setInputFile } from "@/lib/image-client";

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/** The pick/validate/HEIC-convert/preview logic shared by both photo
 * fields below — same behavior components/avatar-upload.tsx and
 * components/cover-upload.tsx used to duplicate, now written once. Takes
 * its input ref as a parameter rather than creating and returning one
 * itself — react-hooks/refs flags a ref bundled into a hook's returned
 * object as an unsafe "access during render" even when, as here, it's
 * only ever handed straight to an <input ref={...}>. */
function usePhotoPicker(maxBytes: number, inputRef: RefObject<HTMLInputElement | null>) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    let file = e.target.files?.[0];
    setError(null);
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
        setError("Couldn't read that iPhone photo format. Try a different one.");
        setPreview(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      setConverting(false);
    }
    const validationError = validateImageFile(file, maxBytes);
    if (validationError) {
      setError(validationError);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  function reset() {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return { preview, error, converting, handleFileChange, reset };
}

/**
 * Cover + avatar, edited as one visual block that mirrors the actual
 * profile header (app/profile/[username]/page.tsx: banner behind, avatar
 * overlapping its bottom-left) instead of two disconnected "Photo"/"Cover
 * photo" cards with their own stacked preview-then-buttons panels — seeing
 * the real layout while editing it is the point. Replaces components/
 * avatar-upload.tsx and components/cover-upload.tsx, which had no other
 * callers.
 *
 * Each photo keeps this app's established two-step "pick, then confirm"
 * upload flow (never auto-uploads on file select) — just laid out as a
 * small Save/Cancel pair overlaid on the photo itself instead of a
 * separate button row below it. Avatar and cover are still two independent
 * <form>s/server actions (uploadAvatar/uploadCover) submitted separately
 * from each other and from the profile-fields form below; "Remove" uses
 * the same formAction-override-on-one-button trick avatar-upload.tsx
 * already used, just repositioned.
 */
export function ProfilePhotoEditor({
  name,
  avatarUrl,
  coverUrl,
}: {
  name: string;
  avatarUrl: string | null;
  coverUrl: string | null;
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarField = usePhotoPicker(MAX_AVATAR_BYTES, avatarInputRef);
  const coverField = usePhotoPicker(MAX_COVER_BYTES, coverInputRef);

  const shownCover = coverField.preview ?? coverUrl;
  const shownAvatar = avatarField.preview ?? avatarUrl;

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative h-28 bg-[linear-gradient(135deg,var(--muted),var(--border))]">
        {shownCover && (
          <Image
            src={shownCover}
            alt=""
            fill
            sizes="(min-width: 640px) 512px, 100vw"
            className="object-cover"
          />
        )}
        <form action={uploadCover}>
          <label
            aria-label="Change cover photo"
            className="absolute right-3 top-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
          >
            <Camera className="h-4 w-4" />
            <input
              ref={coverInputRef}
              type="file"
              name="cover"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              onChange={coverField.handleFileChange}
              disabled={coverField.converting}
              className="sr-only"
            />
          </label>
          {coverField.preview && (
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              <SubmitButton size="sm" pendingText="Saving…">
                Save
              </SubmitButton>
              <Button type="button" variant="outline" size="sm" onClick={coverField.reset}>
                Cancel
              </Button>
            </div>
          )}
          {coverUrl && !coverField.preview && (
            // bottom-right, not bottom-left — the avatar overlaps the
            // banner's bottom-left corner (its own -mt-11 below), so
            // anything placed there collides with it regardless of
            // z-index; bottom-right is clear whenever this button shows
            // (Save/Cancel above only render together with it, never
            // alongside it, since they're mutually exclusive preview states).
            <button
              type="submit"
              formAction={removeCover}
              className="absolute bottom-2 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-black/70"
            >
              Remove cover
            </button>
          )}
        </form>
      </div>

      <div className="px-6 pb-5">
        <form action={uploadAvatar} className="-mt-11 flex items-end gap-3">
          <div className="relative shrink-0">
            <Avatar name={name} src={shownAvatar} size={88} className="ring-4 ring-card" />
            <label
              aria-label="Change photo"
              className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <Camera className="h-3.5 w-3.5" />
              <input
                ref={avatarInputRef}
                type="file"
                name="avatar"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
                onChange={avatarField.handleFileChange}
                disabled={avatarField.converting}
                className="sr-only"
              />
            </label>
          </div>
          {avatarField.preview && (
            <div className="flex items-center gap-1.5 pb-1.5">
              <SubmitButton size="sm" pendingText="Saving…">
                Save
              </SubmitButton>
              <Button type="button" variant="outline" size="sm" onClick={avatarField.reset}>
                Cancel
              </Button>
            </div>
          )}
          {avatarUrl && !avatarField.preview && (
            <button
              type="submit"
              formAction={removeAvatar}
              className="pb-2.5 text-xs font-medium text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          )}
        </form>

        {(avatarField.converting || coverField.converting) && (
          <p className="mt-2 text-xs text-muted-foreground">Processing…</p>
        )}
        {(avatarField.error || coverField.error) && (
          <p className="mt-2 text-xs text-destructive">{avatarField.error || coverField.error}</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          JPEG, PNG, WebP, or GIF. Photo max 3MB, cover max 5MB.
        </p>
      </div>
    </Card>
  );
}
