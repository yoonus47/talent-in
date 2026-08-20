import { createClient } from "@/lib/supabase/server";
import type {
  ChallengeAttempt,
  DailyChallengeQuestion,
  Profile,
  QuizResult,
} from "@/lib/types/database";
import type { ReactionType } from "@/lib/reactions";

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

const UNKNOWN_AUTHOR: FeedAuthor = {
  username: "unknown",
  full_name: "Unknown",
  avatar_url: null,
};

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
  reactionCounts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
  shareCount: number;
  sharedByMe: boolean;
  comments: FeedComment[];
};

const EMPTY_REACTION_COUNTS: Record<ReactionType, number> = {
  fire: 0,
  cheers: 0,
  smart: 0,
  respect: 0,
};

export type FeedItem =
  | { type: "post"; post: FeedPost; sortAt: string }
  | { type: "share"; sharer: FeedAuthor & { id: string }; post: FeedPost; sortAt: string };

/**
 * Posts from people the current user follows, plus their own — newest first.
 */
export async function getFeedPosts(currentUserId: string): Promise<FeedItem[]> {
  const supabase = await createClient();

  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", currentUserId);

  const authorIds = [currentUserId, ...(following?.map((f) => f.following_id) ?? [])];

  return getFeedItems(authorIds, currentUserId);
}

/** Posts + reposts by a single author — used on their profile page. */
export async function getUserPosts(
  authorId: string,
  currentUserId: string,
): Promise<FeedItem[]> {
  return getFeedItems([authorId], currentUserId);
}

/**
 * Builds the feed for a set of "followed" author ids: their own posts, plus
 * anything they've shared (even if the original post's author isn't in the
 * list) — merged and sorted by whichever timestamp is more recent, the post
 * or the share. A handful of queries rather than deep PostgREST embeds, so
 * it stays easy to reason about at MVP scale.
 */
async function getFeedItems(authorIds: string[], currentUserId: string): Promise<FeedItem[]> {
  const supabase = await createClient();

  const [{ data: basePosts }, { data: shareRows }] = await Promise.all([
    supabase
      .from("posts")
      .select("*, profiles!posts_user_id_fkey(id, username, full_name, avatar_url)")
      .in("user_id", authorIds)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("shares")
      .select("*, profiles!shares_user_id_fkey(id, username, full_name, avatar_url)")
      .in("user_id", authorIds)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const posts = basePosts ?? [];
  const shares = shareRows ?? [];

  const knownPostIds = new Set(posts.map((p) => p.id));
  const extraPostIds = [...new Set(shares.map((s) => s.post_id))].filter(
    (id) => !knownPostIds.has(id),
  );

  const { data: extraPosts } =
    extraPostIds.length > 0
      ? await supabase
          .from("posts")
          .select("*, profiles!posts_user_id_fkey(id, username, full_name, avatar_url)")
          .in("id", extraPostIds)
      : { data: [] };

  const allPostRows = [...posts, ...(extraPosts ?? [])];
  if (allPostRows.length === 0) return [];

  const allPostIds = allPostRows.map((p) => p.id);

  const [{ data: reactions }, { data: comments }, { data: shareCounts }] = await Promise.all([
    supabase.from("reactions").select("post_id, user_id, reaction_type").in("post_id", allPostIds),
    supabase
      .from("comments")
      .select(
        "id, post_id, content, created_at, profiles!comments_user_id_fkey(username, full_name, avatar_url)",
      )
      .in("post_id", allPostIds)
      .order("created_at", { ascending: true }),
    supabase.from("shares").select("post_id, user_id").in("post_id", allPostIds),
  ]);

  const feedPostById = new Map<string, FeedPost>();

  for (const post of allPostRows) {
    const postReactions = reactions?.filter((r) => r.post_id === post.id) ?? [];
    const reactionCounts = { ...EMPTY_REACTION_COUNTS };
    for (const r of postReactions) reactionCounts[r.reaction_type] += 1;
    const myReaction = postReactions.find((r) => r.user_id === currentUserId)?.reaction_type ?? null;
    const postShares = shareCounts?.filter((s) => s.post_id === post.id) ?? [];
    const postComments =
      comments
        ?.filter((c) => c.post_id === post.id)
        .map((c) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          author: (c.profiles as unknown as FeedAuthor) ?? UNKNOWN_AUTHOR,
        })) ?? [];

    const author = (post.profiles as unknown as FeedAuthor & { id: string }) ?? {
      id: post.user_id,
      ...UNKNOWN_AUTHOR,
    };

    feedPostById.set(post.id, {
      id: post.id,
      content: post.content,
      image_url: post.image_url,
      created_at: post.created_at,
      author,
      reactionCounts,
      myReaction,
      shareCount: postShares.length,
      sharedByMe: postShares.some((s) => s.user_id === currentUserId),
      comments: postComments,
    });
  }

  const items: FeedItem[] = [];

  for (const post of posts) {
    const feedPost = feedPostById.get(post.id);
    if (feedPost) items.push({ type: "post", post: feedPost, sortAt: post.created_at });
  }

  for (const share of shares) {
    const feedPost = feedPostById.get(share.post_id);
    if (!feedPost) continue;
    const sharer = (share.profiles as unknown as FeedAuthor & { id: string }) ?? {
      id: share.user_id,
      ...UNKNOWN_AUTHOR,
    };
    items.push({ type: "share", sharer, post: feedPost, sortAt: share.created_at });
  }

  items.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());

  return items.slice(0, 50);
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

/** Today's 5 daily-challenge questions — answer key withheld server-side. */
export async function getTodayChallenge(): Promise<DailyChallengeQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_challenge");
  if (error) {
    console.error("get_daily_challenge failed:", error.message);
    return [];
  }
  return data ?? [];
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

/** The current user's attempt for today's challenge, if they've done it. */
export async function getTodayAttempt(userId: string): Promise<ChallengeAttempt | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("challenge_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("challenge_date", todayDateString())
    .maybeSingle();
  return data;
}

export type ChallengeStats = { totalPoints: number; currentStreak: number };

/** Total points earned, and current daily-challenge streak (in days). */
export async function getChallengeStats(userId: string): Promise<ChallengeStats> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("challenge_attempts")
    .select("challenge_date, score")
    .eq("user_id", userId)
    .order("challenge_date", { ascending: false })
    .limit(365);

  const attempts = data ?? [];
  const totalPoints = attempts.reduce((sum, a) => sum + a.score, 0);
  const completedDates = new Set(attempts.map((a) => a.challenge_date));

  // Consecutive days with a completed attempt, counting back from today —
  // but if today isn't done yet, start counting from yesterday so the
  // streak doesn't look broken until the day actually ends.
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!completedDates.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let currentStreak = 0;
  while (completedDates.has(cursor.toISOString().slice(0, 10))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { totalPoints, currentStreak };
}

/** Most recent career-quiz result, if the user has taken it. */
export async function getLatestQuizResult(userId: string): Promise<QuizResult | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_results")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
