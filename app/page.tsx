import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

export default async function RoleSelectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  return (
    <div className="relative overflow-hidden">
      {/* Ambient background blobs — purely decorative, low-opacity gradient shapes */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="animate-blob absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "var(--gradient-instagram)" }}
        />
        <div
          className="animate-blob absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-primary opacity-10 blur-3xl"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="animate-fade-up text-center">
          <p className="ig-gradient-text text-lg font-bold">Talent In</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Who&apos;s joining us today?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Pick the option that fits you — we&apos;ll take you to the right place.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role, index) => {
            const Icon = role.icon;
            return (
              <Link
                key={role.slug}
                href={role.href}
                className="animate-fade-up group relative block rounded-xl border border-border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                {!role.ready && (
                  <Badge
                    variant="outline"
                    className="absolute right-4 top-4 text-[10px] text-muted-foreground"
                  >
                    Coming soon
                  </Badge>
                )}
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110",
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-4 font-semibold text-foreground">{role.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
