import { redirect } from "next/navigation";
import { Flame, Trophy } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

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
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar name={profile.full_name} src={profile.avatar_url} size={56} />
          <div>
            <h1 className="text-lg font-bold">{profile.full_name}</h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.grade && <Badge variant="outline">Class {profile.grade}</Badge>}
          {profile.school && <Badge variant="outline">{profile.school}</Badge>}
          {(profile.city || profile.state) && (
            <Badge variant="outline">
              {[profile.city, profile.state].filter(Boolean).join(", ")}
            </Badge>
          )}
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
            <p className="text-xl font-bold leading-none">{stats.totalPoints}</p>
            <p className="text-xs text-muted-foreground">total points</p>
          </div>
        </Card>
      </div>

      {wordOfTheDay && <WordOfTheDay word={wordOfTheDay} />}

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
