"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Portal } from "@/components/portal";
import { cn } from "@/lib/utils";

/**
 * A bare "tap a photo, see it full-size" overlay — components/post-
 * lightbox.tsx's own overlay/backdrop treatment, minus everything that
 * makes that one a full post view (author, caption, reactions, comments).
 * For any single standalone image with nothing else to show alongside it —
 * today just an achievement/certificate photo (components/achievements-
 * editor.tsx, app/profile/[username]/page.tsx).
 */
export function ImageLightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <Portal>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 transition-opacity duration-200",
          mounted ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "relative max-h-[85vh] w-full max-w-xl transition-all duration-200",
            mounted ? "scale-100 opacity-100" : "scale-95 opacity-0",
          )}
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-black">
            <Image src={src} alt={alt} fill sizes="100vw" quality={90} className="object-contain" />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white shadow-md hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </Portal>
  );
}
