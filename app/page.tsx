import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Compass,
  Flame,
  MessagesSquare,
  Sparkles,
  Sprout,
  Trophy,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { APP_VERSION, VersionBadge } from "@/components/version-badge";
import { cn } from "@/lib/utils";

type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
};

const FEATURES: Feature[] = [
  {
    title: "Career quiz",
    description: "Figure out which stream, path, or field actually fits you, not just what's popular.",
    icon: Compass,
    gradient: "linear-gradient(135deg, #6366f1, #a855f7)",
  },
  {
    title: "Daily challenges",
    description: "A fresh set of quick questions every day. Sharpen your brain in a few minutes.",
    icon: Zap,
    gradient: "linear-gradient(135deg, #f43f5e, #ec4899)",
  },
  {
    title: "Word of the day",
    description: "Scratch to reveal a new word, hear how it sounds, and make it yours.",
    icon: Sparkles,
    gradient: "linear-gradient(135deg, #10b981, #14b8a6)",
  },
  {
    title: "Learn & grow",
    description: "Bite-sized skills in coding, communication, and more, made for a school schedule.",
    icon: Sprout,
    gradient: "linear-gradient(135deg, #3b82f6, #22d3ee)",
  },
  {
    title: "Community",
    description: "Ask questions, swap advice, and chat with students who are figuring it out too.",
    icon: MessagesSquare,
    gradient: "linear-gradient(135deg, #8b5cf6, #d946ef)",
  },
  {
    title: "Your own profile",
    description: "Show off what you've built and achieved, and follow people who inspire you.",
    icon: Trophy,
    gradient: "linear-gradient(135deg, #f59e0b, #ef4444)",
  },
];

const STEPS = [
  { title: "Make your profile", description: "Pick a username, add your interests, and you're in." },
  { title: "Find your direction", description: "Take the career quiz and see where your strengths point." },
  { title: "Grow with others", description: "Build skills, join conversations, and keep your streak going." },
];

function GradientBadge({ icon: Icon, gradient }: { icon: LucideIcon; gradient: string }) {
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-md"
      style={{ background: gradient }}
    >
      <Icon className="h-5 w-5" />
    </div>
  );
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  return (
    <div className="relative overflow-hidden">
      {/* Ambient background blobs, purely decorative, vivid but low-opacity */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="animate-blob absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div
          className="animate-blob absolute -right-32 top-1/4 h-96 w-96 rounded-full opacity-25 blur-3xl"
          style={{
            background: "linear-gradient(135deg, #10b981, #22d3ee)",
            animationDelay: "2.5s",
          }}
        />
        <div
          className="animate-blob absolute bottom-0 left-1/3 h-80 w-80 rounded-full opacity-20 blur-3xl"
          style={{
            background: "linear-gradient(135deg, #e11d48, #d946ef)",
            animationDelay: "5s",
          }}
        />
      </div>

      <div className="flex justify-center px-4 pt-3">
        <VersionBadge className="whitespace-nowrap">Alpha v{APP_VERSION} · developer preview</VersionBadge>
      </div>

      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pb-5 pt-3">
        <span className="brand-gradient-text shrink-0 text-xl font-bold">TalentZify</span>
        <Link
          href="/login"
          className="shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          Log in
        </Link>
      </header>

      {deleted && (
        <div className="mx-auto max-w-lg px-4 pt-2">
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-center text-sm text-primary">
            Your account has been deleted.
          </p>
        </div>
      )}

      <section className="mx-auto grid max-w-5xl items-center gap-12 px-4 pb-16 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-8 lg:pb-24">
        <div className="animate-fade-up text-center lg:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Flame className="h-3.5 w-3.5 text-accent" />
            Made for students, ages 13 to 18
          </span>

          <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Find your path.
            <br />
            <span className="brand-gradient-text">Build your future.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-md text-base text-muted-foreground sm:text-lg lg:mx-0">
            Career guidance, real skills, and a community of students who get it. All in one
            place, and free.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/signup"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl px-7 text-base font-semibold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
              style={{ background: "var(--gradient-brand)" }}
            >
              Get started for free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-xl")}>
              I already have an account
            </Link>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            A parent or guardian should know you&apos;re signing up.
          </p>
        </div>

        {/* Decorative preview of the real experience, CSS only (no images to
            load, nothing to slow the first paint). aria-hidden: it's
            illustration, not content. */}
        <div aria-hidden className="relative mx-auto h-[28rem] w-full max-w-sm">
          <Card className="animate-float absolute left-0 top-0 w-64 -rotate-3 p-4 shadow-xl">
            <div className="flex items-center gap-2">
              <GradientBadge icon={Compass} gradient="linear-gradient(135deg, #6366f1, #a855f7)" />
              <div>
                <p className="text-sm font-semibold text-foreground">Which path fits you?</p>
                <p className="text-xs text-muted-foreground">Question 3 of 8</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-3/8 rounded-full" style={{ background: "var(--gradient-brand)" }} />
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="rounded-lg border border-primary bg-primary/10 px-3 py-2 font-medium text-foreground">
                I like building things
              </div>
              <div className="rounded-lg border border-border px-3 py-2 text-muted-foreground">
                I like explaining ideas
              </div>
            </div>
          </Card>

          <Card
            className="animate-float absolute right-0 top-40 w-56 rotate-3 p-4 shadow-xl"
            style={{ animationDelay: "1.2s" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GradientBadge icon={Zap} gradient="linear-gradient(135deg, #f43f5e, #ec4899)" />
                <p className="text-sm font-semibold text-foreground">Daily challenge</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">5 quick questions. New ones tomorrow.</p>
            <div className="mt-3 flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={cn("h-1.5 flex-1 rounded-full", i < 3 ? "bg-accent" : "bg-muted")}
                />
              ))}
            </div>
          </Card>

          <Card
            className="animate-float absolute bottom-0 left-6 w-60 rotate-1 p-4 shadow-xl"
            style={{ animationDelay: "2.4s" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Word of the day
            </p>
            <div className="mt-1 flex items-center justify-between">
              <p className="brand-gradient-text text-xl font-bold">Resilient</p>
              <Volume2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3 h-8 rounded-lg bg-muted" />
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">Scratch to reveal</p>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 lg:pb-24">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
            Built around how students actually learn and connect.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Card
              key={feature.title}
              className="animate-fade-up p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <GradientBadge icon={feature.icon} gradient={feature.gradient} />
              <h3 className="mt-4 font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16 lg:pb-24">
        <h2 className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Up and running in a minute
        </h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="text-center">
              <span className="brand-gradient-text text-4xl font-bold">{index + 1}</span>
              <h3 className="mt-1 font-semibold text-foreground">{step.title}</h3>
              <p className="mx-auto mt-1 max-w-[16rem] text-sm text-muted-foreground">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20">
        <Card className="p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Ready to find <span className="brand-gradient-text">your path?</span>
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground sm:text-base">
            Join TalentZify today. It only takes a minute.
          </p>
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-6 rounded-xl px-8 text-white hover:opacity-90",
            )}
            style={{ background: "var(--gradient-brand)" }}
          >
            Create your account
          </Link>
        </Card>
      </section>

      <footer className="border-t border-border bg-muted/60 px-4 py-8 text-center text-xs text-muted-foreground">
        <p>Teachers, parents, and schools: coming soon.</p>
        <p className="mt-2 flex items-center justify-center gap-3">
          <Link href="/terms" className="hover:text-foreground hover:underline">
            Terms
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" className="hover:text-foreground hover:underline">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}
