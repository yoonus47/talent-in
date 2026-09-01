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

export type ChallengeSubject = "math" | "science";

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

export type NotificationType = "follow" | "reaction" | "comment" | "share";

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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          content: string;
          image_url?: string | null;
          created_at?: string;
        };
        // Posts still can't be edited by users — the one exception is
        // createPost's own best-effort follow-up write of image_url after
        // the row is already inserted (see lib/actions/posts.ts).
        Update: {
          image_url?: string | null;
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
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          content: string;
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
          reaction_type: ReactionType | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          actor_id: string;
          type: NotificationType;
          post_id?: string | null;
          reaction_type?: ReactionType | null;
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
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
export type QuizQuestion = Database["public"]["Tables"]["quiz_questions"]["Row"];
export type QuizResult = Database["public"]["Tables"]["quiz_results"]["Row"];
export type Share = Database["public"]["Tables"]["shares"]["Row"];
export type ChallengeAttempt = Database["public"]["Tables"]["challenge_attempts"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
