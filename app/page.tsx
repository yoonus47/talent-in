import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/lib/roles";

export default async function RoleSelectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  return (
    <div className="relative overflow-hidden">
      {/* Ambient background blobs — purely decorative, vivid but low-opacity */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="animate-blob absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-instagram)" }}
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
            background: "linear-gradient(135deg, #f59e0b, #ec4899)",
            animationDelay: "5s",
          }}
        />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="animate-fade-up text-center">
          <p className="ig-gradient-text text-lg font-bold">TalentZify</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Who&apos;s joining us today?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Pick the option that fits you, and we&apos;ll take you to the right place.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((role, index) => {
            const Icon = role.icon;
            return (
              <Link
                key={role.slug}
                href={role.href}
                className="role-card animate-fade-up group relative block rounded-xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-1.5"
                style={
                  {
                    animationDelay: `${index * 90}ms`,
                    "--role-card-gradient": role.gradient,
                    "--role-card-glow": role.glow,
                  } as CSSProperties
                }
              >
                {!role.ready && (
                  <Badge
                    variant="outline"
                    className="absolute right-4 top-4 text-[10px] text-muted-foreground"
                  >
                    Coming soon
                  </Badge>
                )}
                <div className="role-card-icon flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
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
