"use client";

import { useState } from "react";
import Image from "next/image";
import { BadgeCheck, ExternalLink, Trophy } from "lucide-react";
import { ImageLightbox } from "@/components/image-lightbox";
import { joinedDate } from "@/lib/utils";
import type { Achievement } from "@/lib/types/database";

/** The profile page's read-only display of a profile's achievements/
 * certificates (adding/editing them happens in Settings, see components/
 * achievements-editor.tsx) — a client component only because tapping a
 * certificate photo opens it full-size (components/image-lightbox.tsx),
 * which needs real state the server-rendered profile page can't hold. */
export function AchievementList({ achievements }: { achievements: Achievement[] }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {achievements.map((achievement) => {
        const Icon = achievement.kind === "certificate" ? BadgeCheck : Trophy;
        const meta = [
          achievement.issuer,
          achievement.earned_on ? joinedDate(achievement.earned_on) : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <div key={achievement.id} className="flex items-start gap-3">
            {achievement.image_url ? (
              <button
                type="button"
                onClick={() => setLightboxUrl(achievement.image_url)}
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border"
              >
                <Image src={achievement.image_url} alt="" fill sizes="48px" className="object-cover" />
              </button>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {achievement.image_url && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                {achievement.title}
              </p>
              {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
              {achievement.description && (
                <p className="mt-1 text-sm text-foreground">{achievement.description}</p>
              )}
              {achievement.credential_url && (
                <a
                  href={achievement.credential_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View certificate
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        );
      })}

      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="" onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}
