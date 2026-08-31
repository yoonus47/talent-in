/** Shared helpers for image uploads (avatars, post images) — the same
 * validation rules and storage-URL bookkeeping in one place instead of
 * duplicated per feature. */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Returns an error message if the file fails validation, otherwise null. */
export function validateImageFile(file: File, maxBytes: number): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Use a JPEG, PNG, WebP, or GIF image.";
  }
  if (file.size > maxBytes) {
    return `Image must be under ${Math.round(maxBytes / (1024 * 1024))}MB.`;
  }
  return null;
}

export function extensionFor(mimeType: string): string {
  return mimeType.split("/")[1] ?? "jpg";
}

/**
 * Parses a Supabase Storage public URL back into a bucket-relative path,
 * e.g. ".../storage/v1/object/public/post-images/<uid>/<file>" -> "<uid>/<file>".
 * Returns null for anything that doesn't match (safe no-op for images
 * hosted elsewhere, like the seeded demo posts' picsum.photos URLs).
 */
export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split("?")[0];
  return path || null;
}
