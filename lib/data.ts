import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "node:crypto";
import { extractFirstUrl } from "@/lib/links";
import type {
  ChallengeAttempt,
  Conversation,
  DailyChallengeQuestion,
  Database,
  LinkPreview,
  Message,
  NotificationType,
  CommunityReply,
  CommunityThread,
  CommunityTopic,
  Profile,
  QuizQuestion,
  QuizResult,
  VocabularyWord,
} from "@/lib/types/database";
import type { ReactionType } from "@/lib/reactions";

/**
 * Current authenticated user's profile row, or null if not onboarded yet.
 * Wrapped in React's cache() — both Navbar and the root layout (for
 * SwipeNavigator's tab list) call this in the same request now, and
 * without this they'd each hit Supabase separately for identical data.
 */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
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
});

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
  imageWidth: number | null;
  imageHeight: number | null;
  created_at: string;
  author: FeedAuthor & { id: string };
  isOwnPost: boolean;
  reactionCounts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
  shareCount: number;
  sharedByMe: boolean;
  comments: FeedComment[];
  /** Only ever set for a post with no image (components/post-card.tsx
   * skips the card entirely otherwise) — null both when the post has no
   * URL and when one's never been fetched yet (see getFeedItems below;
   * that case is resolved client-side by components/link-preview-card.tsx
   * calling getLinkPreview on mount, not here). */
  linkPreview: LinkPreview | null;
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

  // A post's first URL, only when it has no image (components/post-card.tsx's
  // own rule for whether a link-preview card even applies) — computed once
  // here so both the batch cache-read below and the final per-post loop
  // use the exact same value, rather than re-running the regex twice.
  const postUrls = new Map<string, string>();
  for (const post of allPostRows) {
    if (post.image_url) continue;
    const url = extractFirstUrl(post.content);
    if (url) postUrls.set(post.id, url);
  }
  const uniquePostUrls = [...new Set(postUrls.values())];

  const [{ data: reactions }, { data: rawComments }, { data: shareCounts }, { data: linkPreviews }] =
    await Promise.all([
      supabase
        .from("reactions")
        .select("post_id, user_id, reaction_type")
        .in("post_id", allPostIds),
      supabase
        .from("comments")
        .select(
          "id, post_id, user_id, content, parent_comment_id, created_at, profiles!comments_user_id_fkey(id, username, full_name, avatar_url)",
        )
        .in("post_id", allPostIds)
        .order("created_at", { ascending: true }),
      supabase.from("shares").select("post_id, user_id").in("post_id", allPostIds),
      // Cache-read only — this never performs the actual outbound fetch
      // (lib/link-preview-fetch.ts), so it can't block the feed's render
      // on a slow third-party site. A URL with no cache entry yet (or a
      // stale one) resolves live, client-side, via
      // components/link-preview-card.tsx calling getLinkPreview on mount.
      uniquePostUrls.length > 0
        ? supabase.from("link_previews").select("*").in("url", uniquePostUrls)
        : Promise.resolve({ data: [] as LinkPreview[] }),
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

  const linkPreviewByUrl = new Map((linkPreviews ?? []).map((lp) => [lp.url, lp]));

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

    const postUrl = postUrls.get(post.id);
    const linkPreview = postUrl ? (linkPreviewByUrl.get(postUrl) ?? null) : null;

    feedPostById.set(post.id, {
      id: post.id,
      content: post.content,
      image_url: post.image_url,
      imageWidth: post.image_width,
      imageHeight: post.image_height,
      created_at: post.created_at,
      author,
      isOwnPost: post.user_id === currentUserId,
      reactionCounts,
      myReaction,
      shareCount: postShares.length,
      sharedByMe: postShares.some((s) => s.user_id === currentUserId),
      comments: topLevelComments,
      linkPreview,
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
  const [{ count: followers }, { count: following }, { data: viewerFollow }, { data: followsViewer }] =
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
      // Does `profileId` follow `viewerId` back? Combined with the query
      // above, this is what "mutual follow" (required to DM — see
      // lib/actions/chat.ts) actually means.
      supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", profileId)
        .eq("following_id", viewerId)
        .maybeSingle(),
    ]);

  return {
    followers: followers ?? 0,
    following: following ?? 0,
    isFollowing: Boolean(viewerFollow),
    isFollowedBy: Boolean(followsViewer),
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
  conversation: { id: string; name: string | null } | null;
  communityThread: { id: string; title: string } | null;
  communityReply: { id: string; content: string } | null;
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
       comments!notifications_comment_id_fkey(id, content),
       conversations!notifications_conversation_id_fkey(id, name),
       community_threads!notifications_community_thread_id_fkey(id, title),
       community_replies!notifications_community_reply_id_fkey(id, content)`,
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
    conversation: (n.conversations as unknown as { id: string; name: string | null } | null) ?? null,
    communityThread: (n.community_threads as unknown as { id: string; title: string } | null) ?? null,
    communityReply: (n.community_replies as unknown as { id: string; content: string } | null) ?? null,
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

/**
 * Today's Word of the Day — same one for everyone, changes daily, no cron
 * job. Mirrors get_daily_challenge()'s own date-seeded shuffle
 * (`order by md5(id::text || current_date::text)`), just computed in
 * application code instead of SQL: there's no answer key to keep off the
 * client here (a definition isn't a secret), so a dedicated RPC isn't
 * needed — vocabulary_words is plainly readable.
 */
export async function getWordOfTheDay(): Promise<VocabularyWord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("vocabulary_words").select("*");
  if (error || !data || data.length === 0) {
    if (error) console.error("getWordOfTheDay failed:", error.message);
    return null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const ranked = data
    .map((word) => ({ word, hash: createHash("md5").update(word.id + today).digest("hex") }))
    .sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));

  return ranked[0].word;
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

export type ReferralStats = {
  referredCount: number;
  recentReferrals: (FeedAuthor & { id: string; createdAt: string })[];
};

/**
 * `userId`'s referral history as the *referrer* — profile.referral_points
 * itself already covers the number (both sides of every redemption, see
 * redeem_referral in 0040_referral_points.sql), this is just who and when,
 * for the "recent invites" list on /invite.
 */
export async function getReferralStats(userId: string): Promise<ReferralStats> {
  const supabase = await createClient();
  // count: "exact" alongside a limited select, so "friends joined" doesn't
  // silently cap at 20 once someone actually gets good at this.
  const { data, count, error } = await supabase
    .from("referrals")
    .select("created_at, referred:profiles!referrals_referred_id_fkey(id, username, full_name, avatar_url)", {
      count: "exact",
    })
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("getReferralStats failed:", error.message);
    return { referredCount: 0, recentReferrals: [] };
  }

  const recentReferrals = (data ?? [])
    .map((r) => {
      const referred = r.referred as unknown as (FeedAuthor & { id: string }) | null;
      return referred ? { ...referred, createdAt: r.created_at } : null;
    })
    .filter((r): r is FeedAuthor & { id: string; createdAt: string } => r !== null);

  return { referredCount: count ?? recentReferrals.length, recentReferrals };
}

/** The career quiz's questions, in display order — previously fetched
 * directly in app/quiz/page.tsx; that page is gone (the quiz now lives
 * inline on /dashboard, see components/career-quiz-card.tsx) but the
 * query itself is unchanged. */
export async function getQuizQuestions(): Promise<QuizQuestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*")
    .order("order", { ascending: true });
  if (error) {
    console.error("getQuizQuestions failed:", error.message);
    return [];
  }
  return data ?? [];
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

// ── Direct messages & groups ────────────────────────────────────────────

/**
 * People `userId` follows AND who follow `userId` back — the only people
 * DMs/groups can be started with (see lib/actions/chat.ts's
 * startConversation / createGroupConversation). Two queries + a JS
 * intersection, same shape as the follow queries in
 * getFollowStats/attachIsFollowing above.
 */
export async function getMutualFollowProfiles(userId: string): Promise<Profile[]> {
  const supabase = await createClient();
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase.from("follows").select("following_id").eq("follower_id", userId),
    supabase.from("follows").select("follower_id").eq("following_id", userId),
  ]);

  const followingIds = new Set(following?.map((f) => f.following_id) ?? []);
  const mutualIds = (followers ?? [])
    .map((f) => f.follower_id)
    .filter((id) => followingIds.has(id));

  if (mutualIds.length === 0) return [];

  const { data, error } = await supabase.from("profiles").select("*").in("id", mutualIds);
  if (error) {
    console.error("getMutualFollowProfiles failed:", error.message);
    return [];
  }
  return data ?? [];
}

export type ChatConversation = {
  id: string;
  type: "dm" | "group";
  title: string;
  avatarUrl: string | null;
  /** dm only — for linking the row's avatar to a profile. */
  otherUserId?: string;
  /** group only. */
  memberCount?: number;
  lastMessage: {
    content: string;
    createdAt: string;
    isOwn: boolean;
    /** group only, and only for messages from someone else. */
    senderName?: string;
  } | null;
  unreadCount: number;
};

/** All of `userId`'s conversations (dm and group alike), newest activity
 * first. Membership comes from conversation_members — the same table
 * that gates RLS on every table involved here — rather than the old
 * user_a_id/user_b_id column check, so dm and group rows are fetched
 * uniformly. */
export async function getConversations(userId: string): Promise<ChatConversation[]> {
  const supabase = await createClient();

  const { data: memberRows, error: memberError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);

  if (memberError) {
    console.error("getConversations failed:", memberError.message);
    return [];
  }
  const conversationIds = (memberRows ?? []).map((m) => m.conversation_id);
  if (conversationIds.length === 0) return [];

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      `id, type, name, icon_url,
       user_a:profiles!conversations_user_a_id_fkey(id, username, full_name, avatar_url),
       user_b:profiles!conversations_user_b_id_fkey(id, username, full_name, avatar_url)`,
    )
    .in("id", conversationIds);

  if (error) {
    console.error("getConversations failed:", error.message);
    return [];
  }
  if (!conversations || conversations.length === 0) return [];

  const groupIds = conversations.filter((c) => c.type === "group").map((c) => c.id);

  const [{ data: messages }, { data: reads }, { data: groupMemberRows }] = await Promise.all([
    supabase
      .from("messages")
      .select("conversation_id, type, content, sender_id, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("conversation_reads")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
      .in("conversation_id", conversationIds),
    groupIds.length > 0
      ? supabase.from("conversation_members").select("conversation_id").in("conversation_id", groupIds)
      : Promise.resolve({ data: [] as { conversation_id: string }[] }),
  ]);

  const memberCountByConversation = new Map<string, number>();
  for (const m of groupMemberRows ?? []) {
    memberCountByConversation.set(m.conversation_id, (memberCountByConversation.get(m.conversation_id) ?? 0) + 1);
  }

  // Batch-fetched newest-first — keep only the first (latest) per
  // conversation, same "batch then reduce in JS" style used for reactions
  // elsewhere in this file.
  const latestByConversation = new Map<
    string,
    { type: "text" | "voice"; content: string | null; sender_id: string; created_at: string }
  >();
  for (const m of messages ?? []) {
    if (!latestByConversation.has(m.conversation_id)) {
      latestByConversation.set(m.conversation_id, m);
    }
  }

  // Sender names for group "Alex: message" previews — looked up from the
  // actual senders of fetched messages (via profiles), NOT current group
  // membership, so a departed member's last message still shows a name
  // instead of going blank.
  const latestSenderIds = [...new Set([...latestByConversation.values()].map((m) => m.sender_id))];
  const { data: senderProfiles } =
    latestSenderIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", latestSenderIds)
      : { data: [] as { id: string; full_name: string }[] };
  const nameBySenderId = new Map((senderProfiles ?? []).map((p) => [p.id, p.full_name]));

  const lastReadByConversation = new Map(
    (reads ?? []).map((r) => [r.conversation_id, r.last_read_at]),
  );

  // Real per-conversation unread counts (how many messages, not just
  // whether anything's unread) — reuses the same already-fetched `messages`
  // batch above, no extra query. getUnreadMessageCount sums these for the
  // navbar/FAB badge, so someone with 3 unread from one person and 2 from
  // another sees "5", not "2" (conversations touched) or "1" (a flag).
  const unreadCountByConversation = new Map<string, number>();
  for (const m of messages ?? []) {
    if (m.sender_id === userId) continue;
    const lastReadAt = lastReadByConversation.get(m.conversation_id);
    if (!lastReadAt || m.created_at > lastReadAt) {
      unreadCountByConversation.set(
        m.conversation_id,
        (unreadCountByConversation.get(m.conversation_id) ?? 0) + 1,
      );
    }
  }

  const result: ChatConversation[] = conversations.map((c) => {
    const latest = latestByConversation.get(c.id);
    const unreadCount = unreadCountByConversation.get(c.id) ?? 0;

    if (c.type === "group") {
      const lastMessage = latest
        ? {
            content: latest.type === "voice" ? "🎤 Voice message" : (latest.content ?? ""),
            createdAt: latest.created_at,
            isOwn: latest.sender_id === userId,
            senderName: latest.sender_id === userId ? undefined : nameBySenderId.get(latest.sender_id),
          }
        : null;

      return {
        id: c.id,
        type: "group" as const,
        title: c.name ?? "Group",
        avatarUrl: c.icon_url,
        memberCount: memberCountByConversation.get(c.id) ?? 0,
        lastMessage,
        unreadCount,
      };
    }

    const userA = c.user_a as unknown as (FeedAuthor & { id: string }) | null;
    const userB = c.user_b as unknown as (FeedAuthor & { id: string }) | null;
    const otherUser = (userA?.id === userId ? userB : userA) ?? { id: "", ...UNKNOWN_AUTHOR };

    const lastMessage = latest
      ? {
          content: latest.type === "voice" ? "🎤 Voice message" : (latest.content ?? ""),
          createdAt: latest.created_at,
          isOwn: latest.sender_id === userId,
        }
      : null;

    return {
      id: c.id,
      type: "dm" as const,
      title: otherUser.full_name,
      avatarUrl: otherUser.avatar_url,
      otherUserId: otherUser.id,
      lastMessage,
      unreadCount,
    };
  });

  result.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? "";
    const bTime = b.lastMessage?.createdAt ?? "";
    return bTime.localeCompare(aTime);
  });

  return result;
}

/** Number of conversations with something unread, for the navbar badge. */
export async function getUnreadMessageCount(userId: string): Promise<number> {
  const conversations = await getConversations(userId);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

/** A single conversation (dm or group). RLS (conversation_members
 * membership, 0019_group_chats.sql) is the real guard — a non-member gets
 * null back regardless — the thread page 404s/redirects on that. */
export async function getConversation(id: string): Promise<Conversation | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("conversations").select("*").eq("id", id).maybeSingle();
  return data;
}

/** The other participant in a *dm* conversation the viewer is part of. */
export async function getOtherParticipant(
  conversation: Conversation,
  viewerId: string,
): Promise<Profile | null> {
  const supabase = await createClient();
  const otherId =
    conversation.user_a_id === viewerId ? conversation.user_b_id : conversation.user_a_id;
  if (!otherId) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
  return data;
}

export type GroupMember = {
  id: string;
  role: "admin" | "member";
} & FeedAuthor;

/** Group name + ordered member list (earliest-joined first), for the
 * thread header and the /chat/[id]/info page. Null if `id` isn't a group
 * conversation the viewer belongs to (RLS-gated, same as getConversation). */
export async function getGroupInfo(
  id: string,
): Promise<{ id: string; name: string; iconUrl: string | null; members: GroupMember[] } | null> {
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, name, icon_url, type")
    .eq("id", id)
    .eq("type", "group")
    .maybeSingle();
  if (!conversation) return null;

  const { data: members } = await supabase
    .from("conversation_members")
    .select("user_id, role, profiles(id, username, full_name, avatar_url)")
    .eq("conversation_id", id)
    .order("joined_at", { ascending: true });

  return {
    id: conversation.id,
    name: conversation.name ?? "Group",
    iconUrl: conversation.icon_url,
    members: (members ?? []).map((m) => {
      const profile = m.profiles as unknown as (FeedAuthor & { id: string }) | null;
      return {
        id: m.user_id,
        role: m.role,
        username: profile?.username ?? "unknown",
        full_name: profile?.full_name ?? "Unknown",
        avatar_url: profile?.avatar_url ?? null,
      };
    }),
  };
}

/** Most recent 50 messages in a conversation, oldest first for rendering.
 * Pagination beyond this is a deliberate v1 cut — see the chat plan. */
export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("getMessages failed:", error.message);
    return [];
  }
  return (data ?? []).reverse();
}

/** Profile lookup for a set of messages' senders — built from the actual
 * senders (via profiles), not current group membership, so a departed
 * member's old messages still render a name/avatar in group threads
 * instead of going blank. Used by ChatThread for sender attribution. */
export async function getMessageSenderProfiles(
  messages: Pick<Message, "sender_id">[],
): Promise<Map<string, FeedAuthor & { id: string }>> {
  const senderIds = [...new Set(messages.map((m) => m.sender_id))];
  if (senderIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", senderIds);

  return new Map((data ?? []).map((p) => [p.id, p]));
}

/** The other participant's last-read timestamp, for the "Seen" indicator
 * — dm only, see the chat plan's v1 cuts for why groups don't get a
 * "seen by N" equivalent yet. */
/**
 * Every member's read-marker for a conversation, as user_id -> last_read_at
 * — dm and group alike (a dm is really just a 2-member group for this
 * purpose). Powers the WhatsApp-style per-message check/checkmark status
 * in components/message-bubble.tsx: a member with no row here has never
 * opened the thread at all (markConversationRead upserts lazily, on
 * first open — see components/chat-fab-button.tsx's own comment on that),
 * which correctly reads as "hasn't seen this" rather than an error.
 */
export async function getConversationReadReceipts(
  conversationId: string,
): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_reads")
    .select("user_id, last_read_at")
    .eq("conversation_id", conversationId);
  return Object.fromEntries((data ?? []).map((r) => [r.user_id, r.last_read_at]));
}

/** Same shape as getConversationReadReceipts, for the delivery watermark
 * instead — see supabase/migrations/0029_delivery_receipts.sql. */
export async function getConversationDeliveryReceipts(
  conversationId: string,
): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_deliveries")
    .select("user_id, last_delivered_at")
    .eq("conversation_id", conversationId);
  return Object.fromEntries((data ?? []).map((r) => [r.user_id, r.last_delivered_at]));
}

// ── Community ────────────────────────────────────────────────────────────
// v1 (supabase/migrations/0028_community.sql) + round 2 (0030_community_
// reactions_and_activity.sql: reactions, reply mentions, per-thread
// unread tracking). Mirrors this file's existing embedded-select join
// style (getConversations' user_a:profiles!fkey(...) pattern) — no
// disambiguating !fkey needed for author/topic since community_threads/
// community_replies each have only one FK to profiles.

/** An author as embedded in a thread/reply — FeedAuthor plus id (as
 * elsewhere in this file) plus community_points, so a karma badge can
 * render next to a name with no extra query. Selected directly in the
 * embedded `author:profiles!...fkey(...)` queries below. */
export type CommunityAuthor = FeedAuthor & { id: string; community_points: number };

export type CommunityThreadListItem = CommunityThread & {
  author: CommunityAuthor;
  topic: Pick<CommunityTopic, "id" | "slug" | "name">;
  reactionCounts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
  /** True when this thread has had activity (a new reply, most likely)
   * since `currentUserId` last opened it — or was never opened at all.
   * Computed against community_thread_reads (0030), the same "watermark,
   * not a per-item receipt" shape conversation_reads already uses for
   * chat. Always false for a thread the viewer has never *had a chance*
   * to see stale — i.e. this is "unseen since last visit," not "unread"
   * in a stricter sense; there's no separate concept of dismissing it
   * without opening the thread. */
  isNew: boolean;
  /** Whether `currentUserId` is in community_thread_follows for this
   * thread — auto-true for its own author and anyone who's replied (see
   * lib/actions/community.ts), explicitly toggleable otherwise. Drives
   * both the Follow/Following button and (via getFollowedCommunityThreadIds)
   * the /community "Following" filter. */
  isFollowing: boolean;
  /** Whether `currentUserId` has bookmarked this thread
   * (community_thread_saves, 0033_community_round4.sql) — a purely
   * personal marker, unlike isFollowing this implies no notifications and
   * nobody else ever reads it. Drives the Save button and the "Saved"
   * list filter. */
  isSaved: boolean;
  /** Whether this thread has a poll — "📊 Poll" auto-badge, both here and
   * on the thread page. Not stored on the row itself (no is_poll flag —
   * "has options" already answers it), so this is batched alongside the
   * other extras rather than requiring a second round-trip per row. */
  hasPoll: boolean;
};

/** What to actually show for a thread's author — the real profile,
 * unless it was posted anonymously (is_anonymous, 0031_community_round3.
 * sql) and the viewer isn't the poster themselves (the author always
 * sees their own name on their own anonymous thread, matching Reddit's
 * "u/you" treatment on your own throwaway-flagged post). This is UI-only
 * masking, not real anonymity — see that migration's own comment — so
 * `thread.author.id` stays the real id underneath regardless; keep using
 * *that* for ownership checks (delete/pin/best-answer), never this. */
export function communityAuthorDisplay(
  thread: Pick<CommunityThreadListItem, "author" | "is_anonymous">,
  viewerId: string,
): { name: string; avatarUrl: string | null; username: string | null } {
  if (thread.is_anonymous && thread.author.id !== viewerId) {
    return { name: "Anonymous", avatarUrl: null, username: null };
  }
  return {
    name: thread.author.full_name,
    avatarUrl: thread.author.avatar_url,
    username: thread.author.username,
  };
}

/** The curated topic list, in display order. */
export async function getCommunityTopics(): Promise<CommunityTopic[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("community_topics")
    .select("*")
    .order("order", { ascending: true });
  if (error) {
    console.error("getCommunityTopics failed:", error.message);
    return [];
  }
  return data ?? [];
}

const HOT_WINDOW_DAYS = 14;

export type CommunityThreadsOptions = {
  topicId?: string;
  searchQuery?: string;
  /** "new" (default) is last_activity_at desc, same as always. "hot"
   * restricts to threads active in the last HOT_WINDOW_DAYS and ranks by
   * reply_count + total reactions — a plain count, not a time-decayed
   * score; simple on purpose; good enough to surface "people are piling
   * onto this" over "whatever was bumped most recently," without the
   * complexity a real decay function would add for a first pass. */
  sort?: "new" | "hot";
  /** Restricts to threads in community_thread_follows for currentUserId
   * — "My activity," in practice: you're auto-followed on anything you
   * start or reply to (lib/actions/community.ts), so this needs no
   * separate "authored OR replied" query of its own. */
  onlyFollowing?: boolean;
  /** Restricts to threads in community_thread_saves for currentUserId —
   * a purely personal bookmark list, independent of onlyFollowing. */
  onlySaved?: boolean;
};

/** Threads, optionally scoped to a topic, a search query (title/body,
 * same `ilike` `.or(...)` shape searchProfiles uses over full_name/
 * username), a sort, and/or "only threads I'm following." Pass the
 * topic's id (the caller already has the topics list loaded for the chip
 * row, so resolving a slug from the URL to an id costs nothing extra). */
export async function getCommunityThreads(
  currentUserId: string,
  options: CommunityThreadsOptions = {},
): Promise<CommunityThreadListItem[]> {
  const { topicId, searchQuery, sort = "new", onlyFollowing = false, onlySaved = false } = options;
  const supabase = await createClient();

  let query = supabase
    .from("community_threads")
    .select("*, author:profiles!community_threads_author_id_fkey(id, username, full_name, avatar_url, community_points), topic:community_topics(id, slug, name)")
    .order("last_activity_at", { ascending: false });
  if (topicId) query = query.eq("topic_id", topicId);
  if (searchQuery) {
    const escaped = searchQuery.replace(/[%,]/g, "");
    query = query.or(`title.ilike.%${escaped}%,body.ilike.%${escaped}%`);
  }
  if (sort === "hot") {
    const since = new Date(Date.now() - HOT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("last_activity_at", since);
  }
  if (onlyFollowing) {
    const { data: follows } = await supabase
      .from("community_thread_follows")
      .select("thread_id")
      .eq("user_id", currentUserId);
    const followedIds = (follows ?? []).map((f) => f.thread_id);
    if (followedIds.length === 0) return [];
    query = query.in("id", followedIds);
  }
  if (onlySaved) {
    const { data: saves } = await supabase
      .from("community_thread_saves")
      .select("thread_id")
      .eq("user_id", currentUserId);
    const savedIds = (saves ?? []).map((s) => s.thread_id);
    if (savedIds.length === 0) return [];
    query = query.in("id", savedIds);
  }

  const { data, error } = await query;
  if (error) {
    console.error("getCommunityThreads failed:", error.message);
    return [];
  }
  const threads = (data ?? []) as unknown as (CommunityThread & {
    author: CommunityAuthor;
    topic: Pick<CommunityTopic, "id" | "slug" | "name">;
  })[];
  if (threads.length === 0) return [];

  const withExtras = await attachCommunityThreadExtras(supabase, threads, currentUserId);

  if (sort === "hot") {
    withExtras.sort((a, b) => {
      const scoreA = a.reply_count + Object.values(a.reactionCounts).reduce((x, y) => x + y, 0);
      const scoreB = b.reply_count + Object.values(b.reactionCounts).reduce((x, y) => x + y, 0);
      return scoreB - scoreA;
    });
  }

  return withExtras;
}

/** A single thread + its author/topic — RLS (open select) means a null
 * result here only ever means "doesn't exist," not "not allowed to see." */
export async function getCommunityThread(
  id: string,
  currentUserId: string,
): Promise<CommunityThreadListItem | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("community_threads")
    .select("*, author:profiles!community_threads_author_id_fkey(id, username, full_name, avatar_url, community_points), topic:community_topics(id, slug, name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const [withExtras] = await attachCommunityThreadExtras(
    supabase,
    [data as unknown as CommunityThread & { author: CommunityAuthor; topic: Pick<CommunityTopic, "id" | "slug" | "name"> }],
    currentUserId,
  );
  return withExtras;
}

/** Batches thread reactions + this user's read-watermarks for a set of
 * threads and folds them in — same two-pass "fetch the base rows, then
 * batch-fetch related rows by id list" shape getFeedPosts already uses
 * for post reactions, just shared here since getCommunityThreads and
 * getCommunityThread both need it (a list of many, or a list of one). */
async function attachCommunityThreadExtras(
  supabase: SupabaseClient<Database>,
  threads: (CommunityThread & {
    author: CommunityAuthor;
    topic: Pick<CommunityTopic, "id" | "slug" | "name">;
  })[],
  currentUserId: string,
): Promise<CommunityThreadListItem[]> {
  const threadIds = threads.map((t) => t.id);
  const [{ data: reactions }, { data: reads }, { data: follows }, { data: saves }, { data: polls }] =
    await Promise.all([
      supabase.from("community_thread_reactions").select("thread_id, user_id, reaction_type").in("thread_id", threadIds),
      supabase
        .from("community_thread_reads")
        .select("thread_id, last_viewed_at")
        .eq("user_id", currentUserId)
        .in("thread_id", threadIds),
      supabase
        .from("community_thread_follows")
        .select("thread_id")
        .eq("user_id", currentUserId)
        .in("thread_id", threadIds),
      supabase
        .from("community_thread_saves")
        .select("thread_id")
        .eq("user_id", currentUserId)
        .in("thread_id", threadIds),
      supabase.from("community_poll_options").select("thread_id").in("thread_id", threadIds),
    ]);

  const readByThreadId = new Map((reads ?? []).map((r) => [r.thread_id, r.last_viewed_at]));
  const followedThreadIds = new Set((follows ?? []).map((f) => f.thread_id));
  const savedThreadIds = new Set((saves ?? []).map((s) => s.thread_id));
  const pollThreadIds = new Set((polls ?? []).map((p) => p.thread_id));

  return threads.map((thread) => {
    const threadReactions = reactions?.filter((r) => r.thread_id === thread.id) ?? [];
    const reactionCounts = { ...EMPTY_REACTION_COUNTS };
    for (const r of threadReactions) reactionCounts[r.reaction_type] += 1;
    const myReaction = threadReactions.find((r) => r.user_id === currentUserId)?.reaction_type ?? null;
    const lastViewedAt = readByThreadId.get(thread.id);
    const isNew = !lastViewedAt || thread.last_activity_at > lastViewedAt;
    const isFollowing = followedThreadIds.has(thread.id);
    const hasPoll = pollThreadIds.has(thread.id);
    const isSaved = savedThreadIds.has(thread.id);

    return { ...thread, reactionCounts, myReaction, isNew, isFollowing, isSaved, hasPoll };
  });
}

export type CommunityReplyItem = CommunityReply & {
  author: CommunityAuthor;
  reactionCounts: Record<ReactionType, number>;
  myReaction: ReactionType | null;
  /** One level of nesting only (parent_reply_id, 0033_community_round4.
   * sql) — always empty on a reply that's itself nested, exactly matching
   * FeedComment's own shape/reasoning above for feed comments. */
  replies: CommunityReplyItem[];
};

/** A thread's replies, grouped one level deep (top-level + their direct
 * replies) — same shape/reasoning as this file's own buildFeedComment for
 * feed comments, just applied to community_replies. `sort` only reorders
 * the *top-level* list ("new" = chronological, current default; "top" =
 * total reactions desc) — each top-level reply's own nested replies stay
 * chronological regardless, sorting a 1-2 item list has no real value.
 * The thread's best_reply_id (if set, at either level) floats above all
 * of this at render time — unchanged from round 3, handled by the page,
 * not here. */
export async function getCommunityReplies(
  threadId: string,
  currentUserId: string,
  sort: "new" | "top" = "new",
): Promise<CommunityReplyItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("community_replies")
    .select("*, author:profiles!community_replies_author_id_fkey(id, username, full_name, avatar_url, community_points)")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getCommunityReplies failed:", error.message);
    return [];
  }
  const replies = (data ?? []) as unknown as (CommunityReply & { author: CommunityAuthor })[];
  if (replies.length === 0) return [];

  const replyIds = replies.map((r) => r.id);
  const { data: reactions } = await supabase
    .from("community_reply_reactions")
    .select("reply_id, user_id, reaction_type")
    .in("reply_id", replyIds);

  function buildReplyItem(reply: (typeof replies)[number]): CommunityReplyItem {
    const replyReactions = reactions?.filter((r) => r.reply_id === reply.id) ?? [];
    const reactionCounts = { ...EMPTY_REACTION_COUNTS };
    for (const r of replyReactions) reactionCounts[r.reaction_type] += 1;
    const myReaction = replyReactions.find((r) => r.user_id === currentUserId)?.reaction_type ?? null;
    return { ...reply, reactionCounts, myReaction, replies: [] };
  }

  const topLevel = replies.filter((r) => !r.parent_reply_id).map(buildReplyItem);
  for (const top of topLevel) {
    top.replies = replies.filter((r) => r.parent_reply_id === top.id).map(buildReplyItem);
  }

  if (sort === "top") {
    topLevel.sort((a, b) => {
      const scoreA = Object.values(a.reactionCounts).reduce((x, y) => x + y, 0);
      const scoreB = Object.values(b.reactionCounts).reduce((x, y) => x + y, 0);
      return scoreB - scoreA;
    });
  }

  return topLevel;
}

export type CommunityPoll = {
  options: { id: string; label: string; votes: number }[];
  totalVotes: number;
  /** null if this user hasn't voted (or isn't logged in) — the poll UI
   * uses this to decide "show results" vs "show pick-an-option," same as
   * every poll feature does. */
  myOptionId: string | null;
};

/** A thread's poll (if it has one — null otherwise, "has options" is the
 * only signal, no separate is_poll flag) with live vote counts and this
 * viewer's own pick. community_poll_options is only ever written once,
 * at thread creation (createCommunityThread) — no separate "poll changed"
 * case to handle here. */
export async function getCommunityPoll(
  threadId: string,
  currentUserId: string,
): Promise<CommunityPoll | null> {
  const supabase = await createClient();
  const { data: options } = await supabase
    .from("community_poll_options")
    .select("id, label")
    .eq("thread_id", threadId)
    .order("position", { ascending: true });
  if (!options || options.length === 0) return null;

  const { data: votes } = await supabase
    .from("community_poll_votes")
    .select("option_id, user_id")
    .eq("thread_id", threadId);

  const votesByOption = new Map<string, number>();
  let myOptionId: string | null = null;
  for (const v of votes ?? []) {
    votesByOption.set(v.option_id, (votesByOption.get(v.option_id) ?? 0) + 1);
    if (v.user_id === currentUserId) myOptionId = v.option_id;
  }

  return {
    options: options.map((o) => ({ id: o.id, label: o.label, votes: votesByOption.get(o.id) ?? 0 })),
    totalVotes: votes?.length ?? 0,
    myOptionId,
  };
}
