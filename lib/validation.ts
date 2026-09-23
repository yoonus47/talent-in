import { z } from "zod";
import { ALL_HOBBIES, MAX_HOBBIES } from "@/lib/hobbies";

const HOBBY_SET = new Set(ALL_HOBBIES);

// Referral codes are just usernames (talentzify.com/r/<username>) — same
// shape as onboardingSchema.username below, exported so proxy.ts can
// validate a `?ref=` query param before trusting it into a cookie.
export const REFERRAL_CODE_PATTERN = /^[a-z0-9_]{3,24}$/;

export const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  guardianAware: z.literal("on", {
    message: "A parent/guardian needs to be aware you're creating an account",
  }),
});

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const onboardingSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username must be at most 24 characters")
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers, and underscores only"),
  firstName: z.string().trim().min(1, "Enter your first name").max(50),
  lastName: z.string().trim().min(1, "Enter your last name").max(50),
  grade: z.coerce.number().int().min(6).max(12),
  school: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
  interests: z
    .array(z.string())
    .max(MAX_HOBBIES, `Pick up to ${MAX_HOBBIES} hobbies`)
    .refine((values) => values.every((v) => HOBBY_SET.has(v)), "Unrecognized hobby")
    .default([]),
});

export const postSchema = z.object({
  content: z.string().trim().min(1, "Say something first").max(1000),
});

export const commentSchema = z.object({
  content: z.string().trim().min(1).max(500),
});

// Bounds match the check constraints on community_threads/community_replies
// (supabase/migrations/0028_community.sql) — kept in sync deliberately,
// same "client-side validation mirrors the DB constraint" pattern as
// every other schema here.
export const communityThreadSchema = z.object({
  title: z.string().trim().min(1, "Give it a title").max(120),
  body: z.string().trim().min(1, "Say something first").max(3000),
});

export const communityReplySchema = z.object({
  content: z.string().trim().min(1).max(1000),
});
