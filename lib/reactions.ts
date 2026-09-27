export type ReactionType = "heart" | "fire" | "cheers" | "smart" | "respect";

/** Our own small reaction set — not a copy of any other platform's.
 * "heart" comes first: it's the default double-tap reaction (see
 * components/double-tap-react.tsx), same convention as Instagram's like. */
export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "heart", emoji: "❤️", label: "Love" },
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "cheers", emoji: "👏", label: "Cheers" },
  { type: "smart", emoji: "💡", label: "Smart" },
  { type: "respect", emoji: "🙌", label: "Respect" },
];

/** One person who reacted, for the "see who reacted" list — components/
 * reactors-modal.tsx and its two data sources, getPostReactors/
 * getCommentReactors. */
export type Reactor = {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  reactionType: ReactionType;
};
