import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Flame, Gift, Trophy } from "lucide-react";
import {
  getChallengeStats,
  getCurrentProfile,
  getLatestQuizResult,
  getQuizQuestions,
  getTodayAttempt,
  getTodayChallenge,
  getWordOfTheDay,
} from "@/lib/data";
import { DailyChallenge } from "@/components/daily-challenge";
import { CareerQuizCard } from "@/components/career-quiz-card";
import { WordOfTheDay } from "@/components/word-of-the-day";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";

// A first name is required going forward (app/settings/page.tsx), but the
// column itself is nullable in the DB (pre-dates that requirement) — this
// is the one spot on the page that reads it, so the fallback lives here
// rather than widening the column's guarantees everywhere else.
function firstNameOf(profile: { first_name: string | null; full_name: string }) {
  return profile.first_name || profile.full_name.split(" ")[0];
}

// Same "contextual encouragement" idea DailyChallenge's own ScoreHeader
// already uses (this file's sibling component) — a streak-aware line
// instead of a static caption, so the greeting card actually reflects
// today's state rather than reading the same on day 1 and day 30.
function streakMessage(streak: number) {
  if (streak === 0) return "Start today's streak. A few minutes a day adds up fast.";
  if (streak < 3) return `${streak}-day streak. Keep it going!`;
  return `${streak}-day streak. You're on fire! 🔥`;
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const [stats, todayAttempt, quizResult, quizQuestions, todayQuestions, wordOfTheDay] =
    await Promise.all([
      getChallengeStats(profile.id),
      getTodayAttempt(profile.id),
      getLatestQuizResult(profile.id),
      getQuizQuestions(),
      // Always fetched now, even if todayAttempt is already set — see
      // components/daily-challenge.tsx's header comment for why the
      // already-completed/questions decision moved inside that component.
      getTodayChallenge(),
      getWordOfTheDay(),
    ]);

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      {/* Every other tab (Discover, Community) opens with a real page
          title matching its nav label — this one didn't, and used to open
          instead with a full name/avatar/grade/school/location card that
          just duplicated the Profile page (now the actual home for that
          info, see its own header/About-card redesign). Swapped for a
          proper heading plus a compact, streak-aware greeting: still
          personal, but pointed at *today*, which is what a "Learn & Grow"
          tab should be about. */}
      <div>
        <h1 className="text-2xl font-bold">Learn & Grow</h1>
        <p className="text-sm text-muted-foreground">
          Daily practice, vocabulary, and career guidance. A few minutes a day.
        </p>
      </div>

      <Card className="flex items-center gap-3 p-4">
        <Avatar name={profile.full_name} src={profile.avatar_url} size={44} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            Welcome back, {firstNameOf(profile)}
          </p>
          <p className="text-xs text-muted-foreground">{streakMessage(stats.currentStreak)}</p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="flex items-center gap-3 p-4">
          <Flame className="h-8 w-8 text-accent" />
          <div>
            <p className="text-xl font-bold leading-none">{stats.currentStreak}</p>
            <p className="text-xs text-muted-foreground">day streak</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <Trophy className="h-8 w-8 text-accent" />
          <div>
            {/* getChallengeStats' own total (daily-challenge scores only)
                plus profile.community_points (threads/replies/best-answers
                — see supabase/migrations/0031_community_round3.sql's
                point triggers) plus profile.referral_points (invite
                bonuses — 0040_referral_points.sql) as one combined "total
                points" stat. All three stay independently tracked/
                auditable server-side (this is purely a display-time sum,
                not a merged column) — the breakdown line underneath is
                what keeps that legible. */}
            <p className="text-xl font-bold leading-none">
              {stats.totalPoints + profile.community_points + profile.referral_points}
            </p>
            <p className="text-xs text-muted-foreground">total points</p>
            {/* text-pretty: this card's narrow (roughly half the already-
                narrow xl container), so the breakdown wraps almost every
                time — without it, the last word routinely strands itself
                alone on a second line. */}
            <p className="text-pretty text-[11px] text-muted-foreground/70">
              {stats.totalPoints} challenges · {profile.community_points} community ·{" "}
              {profile.referral_points} invites
            </p>
          </div>
        </Card>
      </div>

      {/* A solid --gradient-brand fill here used to compete with (and
          dilute) WordOfTheDay's own gradient-text treatment right below it
          — two loud gradient blocks back to back made neither read as
          special. Toned down to match WordOfTheDay's own restraint
          instead: plain card, gradient reserved for the headline text
          only — same technique, not a louder one. */}
      <Link href="/invite">
        <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-muted">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <Gift className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="brand-gradient-text text-sm font-semibold">Invite friends, earn points</p>
            <p className="text-xs text-muted-foreground">You both get 50 points when they join</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Card>
      </Link>

      {/* mt-6 on top of the container's own space-y-4 (1.5rem + 1rem =
          2.5rem total): the invite card and Word of the Day aren't a
          related pair the way the streak/points cards are — a clearly
          bigger gap than the page's tight uniform rhythm says so, rather
          than a small nudge that still read as "the same group". */}
      {wordOfTheDay && (
        <div className="mt-6">
          <WordOfTheDay word={wordOfTheDay} />
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Daily Challenge</h2>
        <DailyChallenge questions={todayQuestions} todayAttempt={todayAttempt} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Career Quiz</h2>
        <CareerQuizCard questions={quizQuestions} quizResult={quizResult} />
      </div>
    </div>
  );
}
