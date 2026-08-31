"use client";

import { useRef, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { validateImageFile } from "@/lib/uploads";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Lives inside Composer's existing <form action={createPost}> as a plain
 * `name="image"` file input — no form/submit button of its own, since the
 * image uploads together with the post text in one createPost call.
 */
export function PostImagePicker() {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setError(null);
      return;
    }
    const validationError = validateImageFile(file, MAX_BYTES);
    if (validationError) {
      setError(validationError);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    setPreview(URL.createObjectURL(file));
  }

  function clear() {
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      {preview ? (
        <div className="relative mt-2 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt=""
            className="max-h-48 rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            onClick={clear}
            aria-label="Remove image"
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-foreground hover:bg-background"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
          <ImageIcon className="h-3.5 w-3.5" />
          Add photo
          <input
            ref={inputRef}
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleChange}
            className="sr-only"
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
