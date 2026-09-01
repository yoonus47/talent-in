"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { uploadAvatar, removeAvatar } from "@/lib/actions/profile";
import { Avatar } from "@/components/ui/avatar";
import { SubmitButton } from "@/components/submit-button";
import { validateImageFile } from "@/lib/uploads";
import { isHeicFile, convertToJpeg, setInputFile } from "@/lib/image-client";

const MAX_BYTES = 3 * 1024 * 1024;

export function AvatarUpload({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
        setError("Couldn't read that iPhone photo format — try a different one.");
        setPreview(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      setConverting(false);
    }

    const validationError = validateImageFile(file, MAX_BYTES);
    if (validationError) {
      setError(validationError);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} src={preview ?? avatarUrl} size={72} />
      <div className="flex-1">
        <form action={uploadAvatar} className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <Camera className="mr-1.5 inline h-4 w-4" />
            {converting ? "Processing…" : "Choose photo"}
            <input
              ref={inputRef}
              type="file"
              name="avatar"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              onChange={handleFileChange}
              disabled={converting}
              className="sr-only"
            />
          </label>
          {preview && (
            <SubmitButton size="sm" pendingText="Uploading…">
              Upload
            </SubmitButton>
          )}
          {avatarUrl && !preview && (
            <button
              type="submit"
              formAction={removeAvatar}
              className="text-sm text-muted-foreground hover:text-destructive"
            >
              Remove photo
            </button>
          )}
        </form>
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF. Max 3MB.</p>
      </div>
    </div>
  );
}
