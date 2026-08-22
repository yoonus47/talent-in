import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/roles";

export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  const matched = ROLES.find((r) => r.label === role);
  const Icon = matched?.icon ?? Clock3;
  const label = matched?.label ?? role ?? "This";
  const gradient = matched?.gradient ?? "linear-gradient(135deg, #6366f1, #a855f7)";

  return (
    <div className="mx-auto flex min-h-[80vh] max-w-lg items-center px-4">
      <Card className="animate-fade-up w-full p-8 text-center">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md"
          style={{ background: gradient }}
        >
          <Icon className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-foreground">{label} access is on its way</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;re building out {label.toLowerCase()} accounts next. For now, the student
          experience (feed, career quiz, daily challenges, and more) is fully live.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/student">
            <Button className="w-full sm:w-auto">Explore as a student</Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="w-full gap-1.5 sm:w-auto">
              <ArrowLeft className="h-4 w-4" />
              Choose a different role
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
