import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PILLARS = [
  {
    title: "Career Guidance",
    description: "Figure out which stream, path, or field actually fits you, not just what's popular.",
  },
  {
    title: "Upskilling",
    description: "Bite-sized skills in coding, communication, and more, built for a busy school schedule.",
  },
  {
    title: "Job Readiness",
    description: "Resumes, interviews, and internships: the practical stuff school doesn't teach.",
  },
  {
    title: "Tech Skills",
    description: "Get comfortable with the tools and ideas shaping every future career.",
  },
];

export default async function StudentLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  return (
    <div>
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Not a student?
        </Link>
      </div>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Find your path. Build your <span className="text-primary">future</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Talent In is a community for school students ages 13 to 18: career guidance, real
          skills, and a network of peers, in one place.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup">
            <Button size="lg">Get started for free</Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline">
              Log in
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <Card key={pillar.title} className="p-6">
              <h2 className="font-semibold text-foreground">{pillar.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{pillar.description}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
        Built for students 13 to 18. A parent or guardian should be aware before signing up.
      </section>
    </div>
  );
}
