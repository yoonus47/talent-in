import { revalidatePath } from "next/cache";

/** Posts/reactions/comments/shares render on both the feed and profile pages.
 * A plain (non-"use server") helper so it isn't itself treated as a Server
 * Action — every export from a "use server" file must be async, which this
 * doesn't need to be. Shared by lib/actions/posts.ts and lib/actions/comments.ts. */
export function revalidatePostSurfaces() {
  revalidatePath("/feed");
  revalidatePath("/profile/[username]", "page");
}

/** Follows/blocks render on the feed, discover, profiles, and
 * follower/following lists — revalidate all of them after a graph change.
 * Shared by lib/actions/profile.ts and lib/actions/block.ts. */
export function revalidateSocialSurfaces() {
  revalidatePath("/feed");
  revalidatePath("/discover");
  revalidatePath("/profile/[username]", "page");
  revalidatePath("/profile/[username]/followers", "page");
  revalidatePath("/profile/[username]/following", "page");
}
