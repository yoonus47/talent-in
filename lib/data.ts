import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type {
  ChallengeAttempt,
  DailyChallengeQuestion,
  Database,
  NotificationType,
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
  author: FeedAuthor & { id: string };
  isOwnComment: boolean;
  parentCommentId: string | null;
  reactionCounts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
  /** Always empty on a reply itself — replies are one level deep only. */
  replies: FeedComment[];
};

export type FeedPost = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author: FeedAuthor & { id: string };
  isOwnPost: boolean;
  reactionCounts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
  shareCount: number;
  sharedByMe: boolean;
  comments: FeedComment[];
};

const EMPTY_REACTION_COUNTS: Record<ReactionType, number> = {
  heart: 0,
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

  const [{ data: reactions }, { data: rawComments }, { data: shareCounts }] = await Promise.all([
    supabase.from("reactions").select("post_id, user_id, reaction_type").in("post_id", allPostIds),
    supabase
      .from("comments")
      .select(
        "id, post_id, user_id, content, parent_comment_id, created_at, profiles!comments_user_id_fkey(id, username, full_name, avatar_url)",
      )
      .in("post_id", allPostIds)
      .order("created_at", { ascending: true }),
    supabase.from("shares").select("post_id, user_id").in("post_id", allPostIds),
  ]);

  const comments = rawComments ?? [];
  const commentIds = comments.map((c) => c.id);

  // Comment reactions have no post_id of their own to filter by up front —
  // fetched in a second pass once we know which comments are in play, same
  // two-stage pattern already used above for extraPosts/extraPostIds.
  const { data: commentReactions } =
    commentIds.length > 0
      ? await supabase
          .from("comment_reactions")
          .select("comment_id, user_id, reaction_type")
          .in("comment_id", commentIds)
      : { data: [] };

  function buildFeedComment(c: (typeof comments)[number]): FeedComment {
    const myReactions = commentReactions?.filter((r) => r.comment_id === c.id) ?? [];
    const reactionCounts = { ...EMPTY_REACTION_COUNTS };
    for (const r of myReactions) reactionCounts[r.reaction_type] += 1;
    const myReaction =
      myReactions.find((r) => r.user_id === currentUserId)?.reaction_type ?? null;
    const author = (c.profiles as unknown as (FeedAuthor & { id: string }) | null) ?? {
      id: c.user_id,
      ...UNKNOWN_AUTHOR,
    };

    return {
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      author,
      isOwnComment: c.user_id === currentUserId,
      parentCommentId: c.parent_comment_id,
      reactionCounts,
      myReaction,
      replies: [],
    };
  }

  const feedPostById = new Map<string, FeedPost>();

  for (const post of allPostRows) {
    const postReactions = reactions?.filter((r) => r.post_id === post.id) ?? [];
    const reactionCounts = { ...EMPTY_REACTION_COUNTS };
    for (const r of postReactions) reactionCounts[r.reaction_type] += 1;
    const myReaction = postReactions.find((r) => r.user_id === currentUserId)?.reaction_type ?? null;
    const postShares = shareCounts?.filter((s) => s.post_id === post.id) ?? [];
    const postComments = comments.filter((c) => c.post_id === post.id);
    // One level of nesting: top-level comments each carry their own
    // replies array; a reply's `replies` stays empty (no reply-to-reply).
    const topLevelComments = postComments
      .filter((c) => !c.parent_comment_id)
      .map(buildFeedComment);
    for (const topLevel of topLevelComments) {
      topLevel.replies = postComments
        .filter((c) => c.parent_comment_id === topLevel.id)
        .map(buildFeedComment);
    }

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
      isOwnPost: post.user_id === currentUserId,
      reactionCounts,
      myReaction,
      shareCount: postShares.length,
      sharedByMe: postShares.some((s) => s.user_id === currentUserId),
      comments: topLevelComments,
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

export type ProfileWithFollowState = Profile & { isFollowing: boolean };

/** Marks each profile with whether `viewerId` currently follows them. */
async function attachIsFollowing(
  supabase: SupabaseClient<Database>,
  profiles: Profile[],
  viewerId: string,
): Promise<ProfileWithFollowState[]> {
  if (profiles.length === 0) return [];

  const { data: viewerFollows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId);

  const followingIds = new Set(viewerFollows?.map((f) => f.following_id) ?? []);
  return profiles.map((p) => ({ ...p, isFollowing: followingIds.has(p.id) }));
}

/** People who follow `profileId`, newest first. */
export async function getFollowersList(
  profileId: string,
  viewerId: string,
): Promise<ProfileWithFollowState[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("created_at, profiles!follows_follower_id_fkey(*)")
    .eq("following_id", profileId)
    .order("created_at", { ascending: false });

  const profiles = (data ?? [])
    .map((row) => row.profiles as unknown as Profile)
    .filter(Boolean);
  return attachIsFollowing(supabase, profiles, viewerId);
}

/** People `profileId` follows, newest first. */
export async function getFollowingList(
  profileId: string,
  viewerId: string,
): Promise<ProfileWithFollowState[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("created_at, profiles!follows_following_id_fkey(*)")
    .eq("follower_id", profileId)
    .order("created_at", { ascending: false });

  const profiles = (data ?? [])
    .map((row) => row.profiles as unknown as Profile)
    .filter(Boolean);
  return attachIsFollowing(supabase, profiles, viewerId);
}

export type ProfileSearchFilters = { query?: string; grade?: number; interest?: string };

/** Search/browse students for the Discover -> People tab. */
export async function searchProfiles(
  currentUserId: string,
  filters: ProfileSearchFilters,
): Promise<ProfileWithFollowState[]> {
  const supabase = await createClient();

  let query = supabase.from("profiles").select("*").neq("id", currentUserId).limit(30);

  if (filters.query) {
    const escaped = filters.query.replace(/[%,]/g, "");
    query = query.or(`full_name.ilike.%${escaped}%,username.ilike.%${escaped}%`);
  }
  if (filters.grade) {
    query = query.eq("grade", filters.grade);
  }
  if (filters.interest) {
    query = query.contains("interests", [filters.interest]);
  }

  const { data, error } = await query.order("full_name", { ascending: true });
  if (error) {
    console.error("searchProfiles failed:", error.message);
    return [];
  }

  return attachIsFollowing(supabase, data ?? [], currentUserId);
}

export type SuggestedProfile = Profile & { sharedHobbies: string[] };

/**
 * A handful of "people like you" — not already followed, matching school or
 * sharing an interest. Falls back to newest profiles if there's no signal
 * to match on yet (e.g. onboarding didn't set a school or interests).
 */
export async function getSuggestedProfiles(
  currentUserId: string,
  currentProfile: Profile,
): Promise<SuggestedProfile[]> {
  const supabase = await createClient();

  const { data: following } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", currentUserId);
  const excludeIds = [currentUserId, ...(following?.map((f) => f.following_id) ?? [])];

  let query = supabase
    .from("profiles")
    .select("*")
    .not("id", "in", `(${excludeIds.join(",")})`)
    .limit(10);

  const matchParts: string[] = [];
  if (currentProfile.school) matchParts.push(`school.eq.${currentProfile.school}`);
  if (currentProfile.interests.length > 0) {
    matchParts.push(`interests.ov.{${currentProfile.interests.join(",")}}`);
  }

  query = matchParts.length > 0
    ? query.or(matchParts.join(","))
    : query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error("getSuggestedProfiles failed:", error.message);
    return [];
  }

  const myHobbies = new Set(currentProfile.interests);
  return (data ?? []).map((p) => ({
    ...p,
    sharedHobbies: p.interests.filter((h) => myHobbies.has(h)),
  }));
}

/** Unread notification count, for the navbar bell badge. */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}

export type FeedNotification = {
  id: string;
  type: NotificationType;
  reactionType: ReactionType | null;
  createdAt: string;
  readAt: string | null;
  actor: FeedAuthor & { id: string };
  post: { id: string; content: string } | null;
  comment: { id: string; content: string } | null;
};

/** Most recent notifications for `userId`, newest first. */
export async function getNotifications(userId: string): Promise<FeedNotification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      `id, type, reaction_type, created_at, read_at,
       profiles!notifications_actor_id_fkey(id, username, full_name, avatar_url),
       posts!notifications_post_id_fkey(id, content),
       comments!notifications_comment_id_fkey(id, content)`,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    console.error("getNotifications failed:", error.message);
    return [];
  }

  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    reactionType: n.reaction_type,
    createdAt: n.created_at,
    readAt: n.read_at,
    actor: (n.profiles as unknown as (FeedAuthor & { id: string }) | null) ?? {
      id: "",
      ...UNKNOWN_AUTHOR,
    },
    post: (n.posts as unknown as { id: string; content: string } | null) ?? null,
    comment: (n.comments as unknown as { id: string; content: string } | null) ?? null,
  }));
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
