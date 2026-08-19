/**
 * Hand-written types matching `supabase/migrations/0001_init.sql`, shaped to
 * satisfy @supabase/postgrest-js's `GenericSchema`/`GenericTable` constraints
 * (each table needs `Relationships`; the schema needs `Views`/`Functions`).
 * If you change the schema, update this file to match (or generate it with
 * `npx supabase gen types typescript --project-id <id> > lib/types/database.ts`
 * once the project is linked).
 */

export type ContentCategory =
  | "career_guidance"
  | "upskilling"
  | "job_readiness"
  | "tech_skills";

export type ContentType = "article" | "video" | "quiz_link";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          full_name: string;
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
        Relationships: [];
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
        Update: never;
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
      likes: {
        Row: { post_id: string; user_id: string; created_at: string };
        Insert: { post_id: string; user_id: string; created_at?: string };
        Update: never;
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
    Functions: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type ContentItem = Database["public"]["Tables"]["content_items"]["Row"];
export type QuizQuestion = Database["public"]["Tables"]["quiz_questions"]["Row"];
export type QuizResult = Database["public"]["Tables"]["quiz_results"]["Row"];
