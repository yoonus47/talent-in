import Link from "next/link";
import { FileText, Video, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { categoryLabel, cn } from "@/lib/utils";
import type { ContentCategory } from "@/lib/types/database";

const CATEGORIES: { value: ContentCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "career_guidance", label: "Career Guidance" },
  { value: "upskilling", label: "Upskilling" },
  { value: "job_readiness", label: "Job Readiness" },
  { value: "tech_skills", label: "Tech Skills" },
];

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.value));

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("content_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (category && category !== "all" && VALID_CATEGORIES.has(category as ContentCategory)) {
    query = query.eq("category", category as ContentCategory);
  }

  const { data: items } = await query;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold">Discover</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Curated career, upskilling, and tech resources — picked for students, not recruiters.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c.value}
            href={c.value === "all" ? "/discover" : `/discover?category=${c.value}`}
            className={cn(
              "rounded-full border border-border px-3 py-1.5 text-sm font-medium",
              (category ?? "all") === c.value
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {!items || items.length === 0 ? (
        <Card className="mt-6 p-8 text-center text-sm text-muted-foreground">
          Nothing here yet — check back soon.
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Card className="h-full p-4 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <Badge variant="accent">{categoryLabel(item.category)}</Badge>
                  {item.type === "video" ? (
                    <Video className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <h2 className="mt-3 font-semibold text-foreground">{item.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  Open <ExternalLink className="h-3 w-3" />
                </span>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
