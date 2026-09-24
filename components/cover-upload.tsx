"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { uploadCover, removeCover } from "@/lib/actions/profile";
import { SubmitButton } from "@/components/submit-button";
import { validateImageFile } from "@/lib/uploads";
import { isHeicFile, convertToJpeg, setInputFile } from "@/lib/image-client";

const MAX_BYTES = 5 * 1024 * 1024;

/** Mirrors components/avatar-upload.tsx almost exactly — same HEIC
 * conversion/validation/preview flow, just a wide `fill` image instead of
 * a fixed-size square, and the profile page's own h-24 banner is what
 * this preview is standing in for. */
export function CoverUpload({ coverUrl }: { coverUrl: string | null }) {
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
        setError("Couldn't read that iPhone photo format. Try a different one.");
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

  const shown = preview ?? coverUrl;

  return (
    <div>
      <div className="relative h-24 w-full overflow-hidden rounded-lg border border-border bg-muted">
        {shown ? (
          <Image
            src={shown}
            alt=""
            fill
            sizes="(min-width: 640px) 512px, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No cover photo yet
          </div>
        )}
      </div>
      <form action={uploadCover} className="mt-2 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          <Camera className="mr-1.5 inline h-4 w-4" />
          {converting ? "Processing…" : "Choose photo"}
          <input
            ref={inputRef}
            type="file"
            name="cover"
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
        {coverUrl && !preview && (
          <button
            type="submit"
            formAction={removeCover}
            className="text-sm text-muted-foreground hover:text-destructive"
          >
            Remove photo
          </button>
        )}
      </form>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <p className="mt-1 text-xs text-muted-foreground">
        JPEG, PNG, WebP, or GIF. Max 5MB. Wide images look best.
      </p>
    </div>
  );
}
