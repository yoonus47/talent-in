/**
 * Browser-only image helpers — never import this from lib/actions/* or any
 * other server code, it uses DOM APIs (Image, canvas) that don't exist in
 * Node.
 *
 * iPhones save Camera Roll photos as HEIC by default, which (a) isn't in
 * our server's accepted MIME types and (b) wouldn't display correctly for
 * most viewers even if we accepted it — HEIC has poor rendering support
 * outside Safari/Apple platforms, and most students here are on Android.
 * Converting to JPEG client-side, in the same browser that's doing the
 * uploading (which can decode HEIC natively since that's where it came
 * from), fixes both problems without needing a server-side HEIC decoder
 * (fragile in a serverless/Lambda environment without native libheif).
 */

export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/heic" || type === "image/heif") return true;
  // Some mobile browsers leave `type` blank for HEIC files.
  if (!type) return /\.hei[cf]$/i.test(file.name);
  return false;
}

export function convertToJpeg(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (!blob) {
            reject(new Error("Could not convert image"));
            return;
          }
          const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          resolve(new File([blob], newName, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.9,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

/** Replaces a file input's selected file(s) — needed after converting a
 * file client-side, since `input.files` can't be assigned a plain array. */
export function setInputFile(input: HTMLInputElement, file: File) {
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  input.files = dataTransfer.files;
}

/** A photo's natural pixel dimensions — needed so the feed can reserve the
 * correctly-shaped box before the image loads, and so the feed's clamped
 * aspect ratio vs. the lightbox's true ratio have something to work from. */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image dimensions"));
    };
    img.src = url;
  });
}
