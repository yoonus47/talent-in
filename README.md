# TalentZify

A social platform for Indian school students (13–18) built around career guidance, upskilling,
job readiness, and tech skills. See [`/Users/yoonus/.claude/plans/fluttering-baking-wolf.md`](/Users/yoonus/.claude/plans/fluttering-baking-wolf.md)
for the original MVP plan.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **Supabase** — Postgres, Auth (email/password + Google), Storage
- Deploys to **Vercel**; the schema is plain Postgres so a later move to AWS
  (RDS/Cognito/S3) is a lift-and-shift, not a rewrite.

## 1. Create your Supabase project

1. Go to [supabase.com](https://supabase.com), create an account, and create a new project.
2. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
3. Copy `.env.example` to `.env.local` and paste them in:

   ```bash
   cp .env.example .env.local
   ```

## 2. Apply the database schema

In the Supabase dashboard, open **SQL Editor**, and run these two files in order:

1. `supabase/migrations/0001_init.sql` — creates all tables and Row Level Security policies.
2. `supabase/seed.sql` — seeds the Discover content hub (~16 resources) and the 5 career-quiz
   questions. Safe to re-run any time (it clears and re-inserts).

(If you install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
and link the project instead, `supabase db push` applies migrations the same way — just run
`seed.sql` manually afterwards since it's not a numbered migration.)

## 3. (Optional) Enable Google sign-in

Email/password login works with zero extra setup. For "Continue with Google":

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an
   OAuth 2.0 Client ID (Web application).
2. In Supabase: **Authentication → Providers → Google**, paste in your Client ID/Secret.
3. Add the redirect URL Supabase shows you (`https://<project-ref>.supabase.co/auth/v1/callback`)
   to the Google OAuth client's **Authorized redirect URIs**.

## 4. Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — sign up, complete onboarding, and you're in.

> **Note on email confirmation**: by default Supabase requires confirming your email before a
> session is created. For faster local testing, you can disable this under
> **Authentication → Providers → Email → Confirm email** (turn it off), or just click the
> confirmation link Supabase emails you.

## Project structure

```
app/                 Routes (App Router) — feed, discover, quiz, profile, settings, auth
components/          Shared UI (Navbar, PostCard, Composer, QuizFlow) + components/ui (design system)
lib/actions/         Server Actions (posts, profile/follow, quiz)
lib/supabase/        Browser/server Supabase clients + the session-refresh helper used by proxy.ts
lib/data.ts          Read-side data-fetching helpers (feed, profile, follow stats)
lib/validation.ts     zod schemas for all forms
supabase/migrations/  SQL schema + Row Level Security policies
supabase/seed.sql     Seed data for the content hub and quiz
proxy.ts              Next.js 16 "Proxy" (formerly Middleware) — session refresh + route gating
```

## What's next (post-MVP)

- Avatar upload via Supabase Storage (bucket policies aren't set up yet)
- Admin UI for managing `content_items` (v1 content is seeded/edited via the Supabase dashboard)
- Report review workflow (reports are stored but only visible via the Supabase dashboard today)
- Move compute to AWS when scaling past what Vercel + Supabase comfortably handle
- React Native companion app
