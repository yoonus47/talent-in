export type ReactionType = "fire" | "cheers" | "smart" | "respect";

/** Our own small reaction set — not a copy of any other platform's. */
export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "cheers", emoji: "👏", label: "Cheers" },
  { type: "smart", emoji: "💡", label: "Smart" },
  { type: "respect", emoji: "🙌", label: "Respect" },
];
