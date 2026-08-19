import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().trim().min(1, "Enter your full name").max(80),
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
  grade: z.coerce.number().int().min(6).max(12),
  school: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
  interests: z.array(z.string()).max(10).default([]),
});

export const postSchema = z.object({
  content: z.string().trim().min(1, "Say something first").max(1000),
});

export const commentSchema = z.object({
  content: z.string().trim().min(1).max(500),
});

export const INTEREST_OPTIONS = [
  "Coding",
  "Design",
  "Entrepreneurship",
  "Writing",
  "Public Speaking",
  "Science",
  "Robotics",
  "Finance",
  "Medicine",
  "Arts & Media",
] as const;
