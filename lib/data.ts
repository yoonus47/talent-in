import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

/** Current authenticated user's profile row, or null if not onboarded yet. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

export type FeedAuthor = Pick<Profile, "username" | "full_name" | "avatar_url">;

export type FeedComment = {
  id: string;
  content: string;
  created_at: string;
  author: FeedAuthor;
};

export type FeedPost = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author: FeedAuthor & { id: string };
  likeCount: number;
  likedByMe: boolean;
  comments: FeedComment[];
};

/**
 * Posts from people the current user follows, plus their own — newest first.
 * A handful of queries rather than deep PostgREST embeds, so it stays easy
 * to reason about at MVP scale.
 */
export async function getFeedPosts(currentUserId: string): Promise<FeedPost[]> {
  const supabase = await createClient();

  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", currentUserId);

  const authorIds = [currentUserId, ...(following?.map((f) => f.following_id) ?? [])];

  return getPostsByAuthorIds(authorIds, currentUserId);
}

/** All posts by a single author — used on their profile page. */
export async function getUserPosts(
  authorId: string,
  currentUserId: string,
): Promise<FeedPost[]> {
  return getPostsByAuthorIds([authorId], currentUserId);
}

async function getPostsByAuthorIds(
  authorIds: string[],
  currentUserId: string,
): Promise<FeedPost[]> {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("*, profiles(id, username, full_name, avatar_url)")
    .in("user_id", authorIds)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  const [{ data: likes }, { data: comments }] = await Promise.all([
    supabase.from("likes").select("post_id, user_id").in("post_id", postIds),
    supabase
      .from("comments")
      .select("id, post_id, content, created_at, profiles(username, full_name, avatar_url)")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
  ]);

  return posts.map((post) => {
    const postLikes = likes?.filter((l) => l.post_id === post.id) ?? [];
    const postComments =
      comments
        ?.filter((c) => c.post_id === post.id)
        .map((c) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          author: (c.profiles as unknown as FeedAuthor) ?? {
            username: "unknown",
            full_name: "Unknown",
            avatar_url: null,
          },
        })) ?? [];

    const author = (post.profiles as unknown as FeedAuthor & { id: string }) ?? {
      id: post.user_id,
      username: "unknown",
      full_name: "Unknown",
      avatar_url: null,
    };

    return {
      id: post.id,
      content: post.content,
      image_url: post.image_url,
      created_at: post.created_at,
      author,
      likeCount: postLikes.length,
      likedByMe: postLikes.some((l) => l.user_id === currentUserId),
      comments: postComments,
    };
  });
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  return data;
}

export async function getFollowStats(profileId: string, viewerId: string) {
  const supabase = await createClient();
  const [{ count: followers }, { count: following }, { data: viewerFollow }] =
    await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileId),
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileId),
      supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", viewerId)
        .eq("following_id", profileId)
        .maybeSingle(),
    ]);

  return {
    followers: followers ?? 0,
    following: following ?? 0,
    isFollowing: Boolean(viewerFollow),
  };
}
