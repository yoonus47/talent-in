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
  results: { question_id: string; correct: boolean }[];
};

export type NotificationType =
  | "follow"
  | "reaction"
  | "comment"
  | "share"
  | "reply"
  | "mention"
  | "comment_reaction"
  | "group_added";

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
        ];
      };
      conversations: {
        Row: {
          id: string;
          type: "dm" | "group";
          user_a_id: string | null;
          user_b_id: string | null;
          name: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type?: "dm" | "group";
          user_a_id?: string | null;
          user_b_id?: string | null;
          name?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        // Only `name` is writable by a client, via the group-rename RLS
        // policy + column-scoped grant (0019_group_chats.sql) — everything
        // else here is set once at creation by a SECURITY DEFINER RPC.
        Update: { name?: string };
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
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          content: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      get_daily_challenge: {
        Args: Record<PropertyKey, never>;
        Returns: DailyChallengeQuestion[];
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
