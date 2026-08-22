import { redirect } from "next/navigation";
import Link from "next/link";
import { Flame, Trophy } from "lucide-react";
import {
  getChallengeStats,
  getCurrentProfile,
  getLatestQuizResult,
  getTodayAttempt,
  getTodayChallenge,
} from "@/lib/data";
import { DailyChallenge } from "@/components/daily-challenge";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const [stats, todayAttempt, quizResult] = await Promise.all([
    getChallengeStats(profile.id),
    getTodayAttempt(profile.id),
    getLatestQuizResult(profile.id),
  ]);

  const todayQuestions = todayAttempt ? [] : await getTodayChallenge();

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

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Daily Challenge</h2>
        {todayAttempt ? (
          <Card className="p-6 text-center">
            <p className="text-2xl">✅</p>
            <p className="mt-2 font-semibold">
              Completed today: {todayAttempt.score}/{todayAttempt.total}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Come back tomorrow for a new one.
            </p>
          </Card>
        ) : (
          <DailyChallenge questions={todayQuestions} />
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Career Quiz</h2>
        <Card className="p-6">
          {quizResult ? (
            <>
              <p className="text-sm text-muted-foreground">Your latest result:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quizResult.suggested_streams.map((stream) => (
                  <Badge key={stream} variant="accent">
                    {stream}
                  </Badge>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              You haven&apos;t taken the career quiz yet.
            </p>
          )}
          <Link
            href="/quiz"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}
          >
            {quizResult ? "Retake quiz" : "Take the quiz"}
          </Link>
        </Card>
      </div>
    </div>
  );
}
