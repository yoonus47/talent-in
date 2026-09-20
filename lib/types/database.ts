/**
 * Hand-written types matching `supabase/migrations/0001_init.sql`, shaped to
 * satisfy @supabase/postgrest-js's `GenericSchema`/`GenericTable` constraints
 * (each table needs `Relationships`; the schema needs `Views`/`Functions`).
 * If you change the schema, update this file to match (or generate it with
 * `npx supabase gen types typescript --project-id <id> > lib/types/database.ts`
 * once the project is linked).
 */

import type { ReactionType } from "@/lib/reactions";
export type { ReactionType };

export type ContentCategory =
  | "career_guidance"
  | "upskilling"
  | "job_readiness"
  | "tech_skills";

export type ContentType = "article" | "video" | "quiz_link";

export type ChallengeSubject = "math" | "science" | "vocabulary";

/** A thread's author-chosen tag — a small fixed set, not a per-topic
 * custom-flair system like Reddit's (no moderator role exists here to
 * manage one). See 0033_community_round4.sql. */
export type CommunityFlair = "question" | "discussion" | "advice" | "resource";

export type DailyChallengeQuestion = {
  id: string;
  subject: ChallengeSubject;
  question: string;
  options: string[];
};

export type DailyChallengeAnswer = { question_id: string; selected_index: number };

export type DailyChallengeResult = {
  score: number;
  total: number;
  // correct_index/explanation are only ever populated here, post-grading
  // (see submit_daily_challenge in supabase/migrations/0027_challenge_
  // explanations.sql) — get_daily_challenge's pre-answer question list
  // still never includes them.
  results: { question_id: string; correct: boolean; correct_index: number; explanation: string }[];
};

export type NotificationType =
  | "follow"
  | "reaction"
  | "comment"
  | "share"
  | "reply"
  | "mention"
  | "comment_reaction"
  | "group_added"
  | "community_reply"
  | "community_reaction"
  | "community_mention"
  | "community_best_answer";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
          first_name: string | null;
          last_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          grade: number | null;
          school: string | null;
          city: string | null;
          state: string | null;
          interests: string[];
          is_minor: boolean;
          // No self-serve upgrade path exists yet (no payment integration)
          // — set via service-role/SQL only. See 0023_voice_messages.sql.
          tier: "free" | "pro";
          // Coarse platform mix, set from the User-Agent header at signup
          // and refreshed on every login — see lib/user-agent.ts and
          // 0025_platform_tracking.sql. Null until a user's first login
          // after this migration.
          platform_os: string | null;
          platform_browser: string | null;
          platform_updated_at: string | null;
          // Community participation total — threads/replies/best-answers
          // in/decrement this via triggers only (0031_community_round3.sql
          // revokes client UPDATE on this column specifically), never
          // written directly by application code. Folded into the
          // dashboard's "total points" stat alongside getChallengeStats'
          // challenge-only total — see app/dashboard/page.tsx.
          community_points: number;
          // Owner-side monitoring only (0034_activity_and_safety_
          // monitoring.sql) — touched on every page load via
          // lib/actions/profile.ts's touchLastActive, throttled server-
          // side. Nothing in the UI reads this; it's readable by other
          // authenticated users only in the same sense city/school/grade
          // already are (profiles' own select policy is `using (true)`) —
          // deliberately not locked down further, since that would mean
          // revoking and re-granting SELECT on profiles' entire column
          // list rather than just this one. See that migration's comment
          // for the actual privacy boundary (the user_safety_summary view).
          last_active_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          full_name: string;
          first_name?: string | null;
          last_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          grade?: number | null;
          school?: string | null;
          city?: string | null;
          state?: string | null;
          interests?: string[];
          is_minor?: boolean;
          tier?: "free" | "pro";
          platform_os?: string | null;
          platform_browser?: string | null;
          platform_updated_at?: string | null;
          community_points?: number;
          last_active_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      follows: {
        Row: { follower_id: string; following_id: string; created_at: string };
        Insert: {
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_following_id_fkey";
            columns: ["following_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          id: string;
          user_id: string;
          content: string;
          image_url: string | null;
          image_width: number | null;
          image_height: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          image_url?: string | null;
          image_width?: number | null;
          image_height?: number | null;
          created_at?: string;
        };
        // Posts still can't be edited by users — the one exception is
        // createPost's own best-effort follow-up write of image_url (plus
        // its dimensions) after the row is already inserted (see
        // lib/actions/posts.ts).
        Update: {
          image_url?: string | null;
          image_width?: number | null;
          image_height?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reactions: {
        Row: {
          post_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          post_id: string;
          user_id: string;
          reaction_type?: ReactionType;
          created_at?: string;
        };
        Update: { reaction_type?: ReactionType };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          content: string;
          parent_comment_id: string | null;
          mentioned_user_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          content: string;
          parent_comment_id?: string | null;
          mentioned_user_ids?: string[];
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_parent_comment_id_fkey";
            columns: ["parent_comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
        ];
      };
      comment_reactions: {
        Row: {
          id: string;
          comment_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          comment_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at?: string;
        };
        Update: { reaction_type?: ReactionType };
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      content_items: {
        Row: {
          id: string;
          title: string;
          description: string;
          type: ContentType;
          category: ContentCategory;
          url: string | null;
          body: string | null;
          thumbnail_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          type: ContentType;
          category: ContentCategory;
          url?: string | null;
          body?: string | null;
          thumbnail_url?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      quiz_questions: {
        Row: {
          id: string;
          question: string;
          options: { label: string; streams: string[] }[];
          order: number;
        };
        Insert: {
          id?: string;
          question: string;
          options: { label: string; streams: string[] }[];
          order: number;
        };
        Update: never;
        Relationships: [];
      };
      quiz_results: {
        Row: {
          id: string;
          user_id: string;
          answers: Record<string, string>;
          suggested_streams: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          answers: Record<string, string>;
          suggested_streams: string[];
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      shares: {
        Row: { id: string; user_id: string; post_id: string; created_at: string };
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shares_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      challenge_questions: {
        Row: {
          id: string;
          subject: ChallengeSubject;
          question: string;
          options: string[];
          correct_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          subject: ChallengeSubject;
          question: string;
          options: string[];
          correct_index: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      vocabulary_words: {
        Row: {
          id: string;
          word: string;
          part_of_speech: string;
          definition: string;
          example_sentence: string;
          // Pronunciation fields, filled by scripts/enrich-vocabulary.mjs
          // from the Free Dictionary API — null until that's run against
          // the environment (the Word of the Day card degrades gracefully
          // when they're missing).
          phonetic: string | null;
          audio_url: string | null;
          source_url: string | null;
          enriched_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          word: string;
          part_of_speech: string;
          definition: string;
          example_sentence: string;
          phonetic?: string | null;
          audio_url?: string | null;
          source_url?: string | null;
          enriched_at?: string | null;
          created_at?: string;
        };
        // Only scripts/enrich-vocabulary.mjs writes here, as the service
        // role — no browser-client path and no column grant.
        Update: {
          phonetic?: string | null;
          audio_url?: string | null;
          source_url?: string | null;
          enriched_at?: string | null;
        };
        Relationships: [];
      };
      challenge_attempts: {
        Row: {
          id: string;
          user_id: string;
          challenge_date: string;
          score: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          challenge_date: string;
          score: number;
          total: number;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          actor_id: string;
          type: NotificationType;
          post_id: string | null;
          comment_id: string | null;
          reaction_type: ReactionType | null;
          conversation_id: string | null;
          community_thread_id: string | null;
          community_reply_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id: string;
          type: NotificationType;
          post_id?: string | null;
          comment_id?: string | null;
          reaction_type?: ReactionType | null;
          conversation_id?: string | null;
          community_thread_id?: string | null;
          community_reply_id?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: { read_at?: string | null };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_community_thread_id_fkey";
            columns: ["community_thread_id"];
            isOneToOne: false;
            referencedRelation: "community_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_community_reply_id_fkey";
            columns: ["community_reply_id"];
            isOneToOne: false;
            referencedRelation: "community_replies";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          id: string;
          type: "dm" | "group";
          user_a_id: string | null;
          user_b_id: string | null;
          name: string | null;
          icon_url: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type?: "dm" | "group";
          user_a_id?: string | null;
          user_b_id?: string | null;
          name?: string | null;
          icon_url?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        // Only `name`/`icon_url` are writable by a client, via the
        // group-rename RLS policy + column-scoped grant (0019_group_chats
        // .sql, extended by 0022_group_icons.sql) — everything else here
        // is set once at creation by a SECURITY DEFINER RPC.
        Update: { name?: string; icon_url?: string | null };
        Relationships: [
          {
            foreignKeyName: "conversations_user_a_id_fkey";
            columns: ["user_a_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_user_b_id_fkey";
            columns: ["user_b_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: "admin" | "member";
          joined_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          role?: "admin" | "member";
          joined_at?: string;
        };
        // Role changes are trigger-only (promote_next_admin,
        // 0019_group_chats.sql) — no client ever updates a member row.
        Update: never;
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          type: "text" | "voice";
          content: string | null;
          audio_url: string | null;
          duration_ms: number | null;
          // Reply-quote snapshot, server-computed by a BEFORE INSERT
          // trigger (0026_chat_reply_and_mentions.sql) from whatever
          // reply_to_id the client sent — never trust these 4 as
          // client-authored, even though they're technically writable on
          // insert (see that migration's header comment). reply_to_id can
          // independently null out later (on delete set null, when the
          // original is unsent) while the rest of the snapshot stays.
          reply_to_id: string | null;
          reply_to_sender_id: string | null;
          reply_to_sender_name: string | null;
          reply_to_type: "text" | "voice" | null;
          reply_to_preview: string | null;
          // Also server-filtered by the same trigger down to actual
          // current conversation members minus the sender — see
          // components/message-text.tsx for how @all/@everyone/@username
          // get rendered from the stored text (presentation-time only,
          // same as comments.mentioned_user_ids; this array itself is
          // only used to decide who gets a "mention" notification).
          mentioned_user_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          type?: "text" | "voice";
          content?: string | null;
          audio_url?: string | null;
          duration_ms?: number | null;
          reply_to_id?: string | null;
          reply_to_sender_id?: string | null;
          reply_to_sender_name?: string | null;
          reply_to_type?: "text" | "voice" | null;
          reply_to_preview?: string | null;
          mentioned_user_ids?: string[];
          created_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey";
            columns: ["reply_to_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_reads: {
        Row: {
          conversation_id: string;
          user_id: string;
          last_read_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          last_read_at?: string;
        };
        Update: { last_read_at?: string };
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_deliveries: {
        Row: {
          conversation_id: string;
          user_id: string;
          last_delivered_at: string;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          last_delivered_at?: string;
        };
        Update: { last_delivered_at?: string };
        Relationships: [
          {
            foreignKeyName: "conversation_deliveries_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_deliveries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          status?: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      link_previews: {
        Row: {
          id: string;
          url: string;
          status: "ok" | "failed";
          title: string | null;
          description: string | null;
          image_url: string | null;
          site_name: string | null;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          status: "ok" | "failed";
          title?: string | null;
          description?: string | null;
          image_url?: string | null;
          site_name?: string | null;
          fetched_at?: string;
        };
        // Refreshed wholesale on a cache miss/staleness (lib/actions/
        // link-preview.ts's upsert) — no partial-field updates anywhere.
        Update: {
          status?: "ok" | "failed";
          title?: string | null;
          description?: string | null;
          image_url?: string | null;
          site_name?: string | null;
          fetched_at?: string;
        };
        Relationships: [];
      };
      community_topics: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          order: number;
          created_at: string;
        };
        // Curated, not client-writable — no insert/update policy exists,
        // seeded once by 0028_community.sql. Insert/Update kept here only
        // to satisfy GenericTable's shape.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      community_threads: {
        Row: {
          id: string;
          topic_id: string;
          author_id: string;
          title: string;
          body: string;
          // Server-maintained only (sync_community_thread_activity
          // trigger, 0028_community.sql) — never part of a client insert.
          reply_count: number;
          last_activity_at: string;
          // UI-only anonymity — author_id above is still the real author,
          // still visible in the raw payload. See 0031_community_round3.sql.
          is_anonymous: boolean;
          // Both below are only ever changed via RPC (set_community_
          // thread_pinned / set_community_best_reply, 0031), never a
          // direct client .update() — Update stays `never` below.
          is_pinned: boolean;
          best_reply_id: string | null;
          image_url: string | null;
          image_width: number | null;
          image_height: number | null;
          // Author-chosen, from a small fixed set (0033_community_
          // round4.sql) — "Poll"/"Solved" are computed at render time
          // instead (has poll options / best_reply_id set), not stored.
          flair: CommunityFlair | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          topic_id: string;
          author_id: string;
          title: string;
          body: string;
          is_anonymous?: boolean;
          image_url?: string | null;
          image_width?: number | null;
          image_height?: number | null;
          flair?: CommunityFlair | null;
          created_at?: string;
        };
        // The ONLY columns a client update() can touch — a column-level
        // grant (0031_community_round3.sql) restricts it beneath RLS,
        // regardless of what shape this type allows. is_pinned/
        // best_reply_id are exclusively written by the two SECURITY
        // DEFINER RPCs above, which bypass this grant entirely (they run
        // as the function owner, not as the authenticated client).
        Update: { image_url?: string | null; image_width?: number | null; image_height?: number | null };
        Relationships: [
          {
            foreignKeyName: "community_threads_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "community_topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_threads_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_replies: {
        Row: {
          id: string;
          thread_id: string;
          author_id: string;
          content: string;
          mentioned_user_ids: string[];
          // One level only, enforced in createCommunityReply (lib/actions/
          // community.ts), not here — same posture as comments.
          // parent_comment_id. Null on a top-level reply.
          parent_reply_id: string | null;
          image_url: string | null;
          image_width: number | null;
          image_height: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          author_id: string;
          content: string;
          mentioned_user_ids?: string[];
          parent_reply_id?: string | null;
          created_at?: string;
        };
        // The ONLY columns a client update() can touch — same column-
        // level-grant story as community_threads' own image columns
        // (0031/0033_community_round4.sql): a normal RLS policy pairs
        // with a narrower grant, so title/content/parent_reply_id/etc.
        // stay locked down regardless of this type.
        Update: { image_url?: string | null; image_width?: number | null; image_height?: number | null };
        Relationships: [
          {
            foreignKeyName: "community_replies_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "community_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_replies_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_replies_parent_reply_id_fkey";
            columns: ["parent_reply_id"];
            isOneToOne: false;
            referencedRelation: "community_replies";
            referencedColumns: ["id"];
          },
        ];
      };
      community_thread_reactions: {
        Row: {
          id: string;
          thread_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at?: string;
        };
        Update: { reaction_type?: ReactionType };
        Relationships: [
          {
            foreignKeyName: "community_thread_reactions_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "community_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_thread_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_reply_reactions: {
        Row: {
          id: string;
          reply_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          reply_id: string;
          user_id: string;
          reaction_type: ReactionType;
          created_at?: string;
        };
        Update: { reaction_type?: ReactionType };
        Relationships: [
          {
            foreignKeyName: "community_reply_reactions_reply_id_fkey";
            columns: ["reply_id"];
            isOneToOne: false;
            referencedRelation: "community_replies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_reply_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_thread_reads: {
        Row: {
          thread_id: string;
          user_id: string;
          last_viewed_at: string;
        };
        Insert: {
          thread_id: string;
          user_id: string;
          last_viewed_at?: string;
        };
        Update: { last_viewed_at?: string };
        Relationships: [
          {
            foreignKeyName: "community_thread_reads_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "community_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_thread_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_thread_follows: {
        Row: { thread_id: string; user_id: string; created_at: string };
        Insert: { thread_id: string; user_id: string; created_at?: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "community_thread_follows_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "community_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_thread_follows_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_poll_options: {
        Row: { id: string; thread_id: string; label: string; position: number };
        // Insert is RLS-scoped to "thread_id points at a thread I
        // authored" (0031_community_round3.sql) — only ever called from
        // createCommunityThread right after the thread insert itself.
        Insert: { id?: string; thread_id: string; label: string; position: number };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "community_poll_options_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "community_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      community_poll_votes: {
        Row: { thread_id: string; user_id: string; option_id: string; created_at: string };
        Insert: { thread_id: string; user_id: string; option_id: string; created_at?: string };
        Update: { option_id?: string };
        Relationships: [
          {
            foreignKeyName: "community_poll_votes_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "community_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_poll_votes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_poll_votes_option_id_fkey";
            columns: ["option_id"];
            isOneToOne: false;
            referencedRelation: "community_poll_options";
            referencedColumns: ["id"];
          },
        ];
      };
      community_reports: {
        Row: {
          id: string;
          reporter_id: string;
          thread_id: string | null;
          reply_id: string | null;
          reason: "spam" | "harassment" | "inappropriate" | "other";
          details: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          thread_id?: string | null;
          reply_id?: string | null;
          reason: "spam" | "harassment" | "inappropriate" | "other";
          details?: string | null;
          created_at?: string;
        };
        // Insert-only from the client — no select policy exists at all
        // (0033_community_round4.sql), so nothing ever reads this back.
        Update: never;
        Relationships: [
          {
            foreignKeyName: "community_reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_reports_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "community_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_reports_reply_id_fkey";
            columns: ["reply_id"];
            isOneToOne: false;
            referencedRelation: "community_replies";
            referencedColumns: ["id"];
          },
        ];
      };
      community_thread_saves: {
        Row: { thread_id: string; user_id: string; created_at: string };
        Insert: { thread_id: string; user_id: string; created_at?: string };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "community_thread_saves_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "community_threads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_thread_saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_daily_challenge: {
        Args: Record<PropertyKey, never>;
        Returns: DailyChallengeQuestion[];
      };
      set_community_best_reply: {
        Args: { p_thread_id: string; p_reply_id: string | null };
        Returns: undefined;
      };
      set_community_thread_pinned: {
        Args: { p_thread_id: string; p_pinned: boolean };
        Returns: undefined;
      };
      submit_daily_challenge: {
        Args: { p_answers: DailyChallengeAnswer[] };
        Returns: DailyChallengeResult;
      };
      delete_own_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      start_dm_conversation: {
        Args: { p_other_id: string };
        Returns: string;
      };
      create_group_conversation: {
        Args: { p_name: string; p_member_ids: string[] };
        Returns: string;
      };
      add_group_members: {
        Args: { p_conversation_id: string; p_member_ids: string[] };
        Returns: undefined;
      };
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
export type QuizQuestion = Database["public"]["Tables"]["quiz_questions"]["Row"];
export type QuizResult = Database["public"]["Tables"]["quiz_results"]["Row"];
export type Share = Database["public"]["Tables"]["shares"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type ChallengeAttempt = Database["public"]["Tables"]["challenge_attempts"]["Row"];
export type VocabularyWord = Database["public"]["Tables"]["vocabulary_words"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
export type ConversationMember = Database["public"]["Tables"]["conversation_members"]["Row"];
export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type LinkPreview = Database["public"]["Tables"]["link_previews"]["Row"];
export type CommunityTopic = Database["public"]["Tables"]["community_topics"]["Row"];
export type CommunityThread = Database["public"]["Tables"]["community_threads"]["Row"];
export type CommunityReply = Database["public"]["Tables"]["community_replies"]["Row"];
