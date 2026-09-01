"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImageIcon, X } from "lucide-react";
import { validateImageFile } from "@/lib/uploads";
import { isHeicFile, convertToJpeg, setInputFile } from "@/lib/image-client";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Lives inside Composer's existing <form action={createPost}> as a plain
 * `name="image"` file input — no form/submit button of its own, since the
 * image uploads together with the post text in one createPost call.
 */
export function PostImagePicker() {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // The parent <form>'s uncontrolled fields (the textarea) reset themselves
  // once createPost finishes and the page revalidates — but this component
  // is a Client Component, so its own preview/file state survives that
  // revalidation untouched. Without this, a selected photo just sits here
  // looking attached/stuck after a successful post, even though the post
  // itself already went out. useFormStatus reports this form's pending
  // state; clear() on the true -> false edge (submission just finished).
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) clear();
    wasPending.current = pending;
  }, [pending]);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setError(null);
      return;
    }

    if (isHeicFile(file)) {
      setConverting(true);
      setError(null);
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
          {converting ? "Processing…" : "Add photo"}
          <input
            ref={inputRef}
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            onChange={handleChange}
            disabled={converting}
            className="sr-only"
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
