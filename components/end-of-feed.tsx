import Link from "next/link";
import { Card } from "@/components/ui/card";

const MESSAGES: { emoji: string; headline: string; body: string }[] = [
  {
    emoji: "🏁",
    headline: "That's everyone. You're all caught up.",
    body: "No infinite scroll here — that was on purpose. Go take today's daily challenge instead.",
  },
  {
    emoji: "🎉",
    headline: "You've reached the end of the internet.",
    body: "Well, your corner of it. The rest can wait — maybe go finish that homework?",
  },
  {
    emoji: "🧘",
    headline: "Feed's empty. Brain's still full.",
    body: "Congrats, you didn't lose 40 minutes to a bottomless scroll. Put it toward something else.",
  },
  {
    emoji: "🌱",
    headline: "Nothing more to see here.",
    body: "Which is the point — this isn't built to keep you scrolling. Go build something instead.",
  },
];

export function EndOfFeed() {
  // Math.random() here is fine: this is a Server Component, picked once per
  // request server-side — there's no client re-render/memoization to upset.
  // eslint-disable-next-line react-hooks/purity
  const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

  return (
    <Card className="p-8 text-center">
      <p className="text-3xl">{message.emoji}</p>
      <p className="mt-2 font-semibold text-foreground">{message.headline}</p>
      <p className="mt-1 text-sm text-muted-foreground">{message.body}</p>
      <div className="mt-4 flex justify-center gap-4 text-sm font-medium">
        <Link href="/dashboard" className="text-primary hover:underline">
          Today&apos;s challenge
        </Link>
        <Link href="/discover" className="text-primary hover:underline">
          Discover
        </Link>
      </div>
    </Card>
  );
}
