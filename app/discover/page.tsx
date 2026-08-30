import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Video, ExternalLink, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getSuggestedProfiles, searchProfiles } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ProfileRow } from "@/components/profile-row";
import { categoryLabel, cn } from "@/lib/utils";
import { HOBBY_CATEGORIES } from "@/lib/hobbies";
import type { ContentCategory } from "@/lib/types/database";

const CATEGORIES: { value: ContentCategory | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "career_guidance", label: "Career Guidance" },
  { value: "upskilling", label: "Upskilling" },
  { value: "job_readiness", label: "Job Readiness" },
  { value: "tech_skills", label: "Tech Skills" },
];

const VALID_CATEGORIES = new Set(CATEGORIES.map((c) => c.value));
const GRADES = [6, 7, 8, 9, 10, 11, 12];

type DiscoverSearchParams = {
  tab?: string;
  category?: string;
  q?: string;
  grade?: string;
  interest?: string;
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<DiscoverSearchParams>;
}) {
  const params = await searchParams;
  const tab = params.tab === "people" ? "people" : "content";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold">Discover</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Career resources and fellow students, in one place.
      </p>

      <div className="mt-5 flex gap-1 rounded-lg border border-border p-1">
        <Link
          href="/discover"
          className={cn(
            "flex-1 rounded-md py-2 text-center text-sm font-medium",
            tab === "content" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          Content
        </Link>
        <Link
          href="/discover?tab=people"
          className={cn(
            "flex-1 rounded-md py-2 text-center text-sm font-medium",
            tab === "people" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          People
        </Link>
      </div>

      {tab === "content" ? (
        <ContentTab category={params.category} />
      ) : (
        <PeopleTab query={params.q} grade={params.grade} interest={params.interest} />
      )}
    </div>
  );
}

async function ContentTab({ category }: { category?: string }) {
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
    <div>
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
          Nothing here yet, check back soon.
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

async function PeopleTab({
  query,
  grade,
  interest,
}: {
  query?: string;
  grade?: string;
  interest?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const hasFilters = Boolean(query || grade || interest);
  const gradeNum = grade ? Number(grade) : undefined;

  const [results, suggested] = await Promise.all([
    searchProfiles(profile.id, { query, grade: gradeNum, interest }),
    hasFilters ? Promise.resolve([]) : getSuggestedProfiles(profile.id, profile),
  ]);

  const selectClass =
    "h-10 rounded-lg border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div>
      <form method="get" className="mt-5 space-y-2">
        <input type="hidden" name="tab" value="people" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name or username…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select name="grade" defaultValue={grade ?? ""} className={selectClass}>
            <option value="">Any class</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Class {g}
              </option>
            ))}
          </select>
          <select name="interest" defaultValue={interest ?? ""} className={cn(selectClass, "flex-1")}>
            <option value="">Any hobby</option>
            {HOBBY_CATEGORIES.map((category) => (
              <optgroup key={category.name} label={category.name}>
                {category.hobbies.map((hobby) => (
                  <option key={hobby} value={hobby}>
                    {hobby}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted"
          >
            Apply
          </button>
        </div>
      </form>

      {!hasFilters && suggested.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Suggested for you</h2>
          <Card className="mt-2 divide-y divide-border px-4">
            {suggested.map((p) => (
              <ProfileRow
                key={p.id}
                profile={{ ...p, isFollowing: false }}
                meta={p.sharedHobbies.length > 0 ? `Into ${p.sharedHobbies.slice(0, 2).join(", ")}` : undefined}
              />
            ))}
          </Card>
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {hasFilters ? "Results" : "All students"}
        </h2>
        {results.length === 0 ? (
          <Card className="mt-2 p-8 text-center text-sm text-muted-foreground">
            No students found. Try a different search or filter.
          </Card>
        ) : (
          <Card className="mt-2 divide-y divide-border px-4">
            {results.map((p) => (
              <ProfileRow key={p.id} profile={p} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
