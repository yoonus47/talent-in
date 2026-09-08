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
  Profile,
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

// ── Direct messages ─────────────────────────────────────────────────────

/**
 * People `userId` follows AND who follow `userId` back — the only people
 * DMs can be started with (see lib/actions/chat.ts's startConversation).
 * Two queries + a JS intersection, same shape as the follow queries in
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
  otherUser: FeedAuthor & { id: string };
  lastMessage: { content: string; createdAt: string; isOwn: boolean } | null;
  unreadCount: number;
};

/** All of `userId`'s conversations, newest activity first. */
export async function getConversations(userId: string): Promise<ChatConversation[]> {
  const supabase = await createClient();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select(
      `id, created_at,
       user_a:profiles!conversations_user_a_id_fkey(id, username, full_name, avatar_url),
       user_b:profiles!conversations_user_b_id_fkey(id, username, full_name, avatar_url)`,
    )
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  if (error) {
    console.error("getConversations failed:", error.message);
    return [];
  }
  if (!conversations || conversations.length === 0) return [];

  const conversationIds = conversations.map((c) => c.id);

  const [{ data: messages }, { data: reads }] = await Promise.all([
    supabase
      .from("messages")
      .select("conversation_id, content, sender_id, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("conversation_reads")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId)
      .in("conversation_id", conversationIds),
  ]);

  // Batch-fetched newest-first — keep only the first (latest) per
  // conversation, same "batch then reduce in JS" style used for reactions
  // elsewhere in this file.
  const latestByConversation = new Map<string, { content: string; sender_id: string; created_at: string }>();
  for (const m of messages ?? []) {
    if (!latestByConversation.has(m.conversation_id)) {
      latestByConversation.set(m.conversation_id, m);
    }
  }

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
    const userA = c.user_a as unknown as (FeedAuthor & { id: string }) | null;
    const userB = c.user_b as unknown as (FeedAuthor & { id: string }) | null;
    const otherUser = (userA?.id === userId ? userB : userA) ?? { id: "", ...UNKNOWN_AUTHOR };

    const latest = latestByConversation.get(c.id);
    const lastMessage = latest
      ? { content: latest.content, createdAt: latest.created_at, isOwn: latest.sender_id === userId }
      : null;

    const unreadCount = unreadCountByConversation.get(c.id) ?? 0;

    return { id: c.id, otherUser, lastMessage, unreadCount };
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

/** A single conversation, only if `viewerId` is a participant (defense in
 * depth on top of RLS — used by the thread page to 404/redirect otherwise). */
export async function getConversation(
  id: string,
  viewerId: string,
): Promise<Conversation | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .or(`user_a_id.eq.${viewerId},user_b_id.eq.${viewerId}`)
    .maybeSingle();
  return data;
}

/** The other participant in a conversation the viewer is part of. */
export async function getOtherParticipant(
  conversation: Conversation,
  viewerId: string,
): Promise<Profile | null> {
  const supabase = await createClient();
  const otherId =
    conversation.user_a_id === viewerId ? conversation.user_b_id : conversation.user_a_id;
  const { data } = await supabase.from("profiles").select("*").eq("id", otherId).maybeSingle();
  return data;
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

/** The other participant's last-read timestamp, for the "Seen" indicator. */
export async function getOtherLastReadAt(
  conversationId: string,
  otherUserId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversation_reads")
    .select("last_read_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", otherUserId)
    .maybeSingle();
  return data?.last_read_at ?? null;
}
