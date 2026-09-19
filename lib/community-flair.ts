import type { CommunityFlair } from "@/lib/types/database";

/** Display labels for the small fixed flair set (0033_community_round4.
 * sql) — shared between components/new-thread-form.tsx's picker,
 * app/community/[id]/page.tsx's badge, and components/community-thread-
 * row.tsx's list-row badge, so all three always agree. */
export const FLAIR_LABELS: Record<CommunityFlair, string> = {
  question: "Question",
  discussion: "Discussion",
  advice: "Advice Wanted",
  resource: "Resource",
};

export const FLAIR_OPTIONS: CommunityFlair[] = ["question", "discussion", "advice", "resource"];
