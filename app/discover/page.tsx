import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Sparkles, Video, ExternalLink, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, getNewMembers, getSuggestedProfiles, searchProfiles } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
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
  school?: string;
};

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<DiscoverSearchParams>;
}) {
  const params = await searchParams;
  // People is the default now: a bare /discover means People,
  // ?tab=content is the explicit opt-in (the inverse of before).
  const tab = params.tab === "content" ? "content" : "people";

  return (
    <div className="animate-fade-up mx-auto max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold">Discover</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Fellow students and career resources, in one place.
      </p>

      <div className="mt-4 rounded-lg border border-border bg-muted p-1">
        <div className="relative flex">
          <div
            aria-hidden
            className={cn(
              "absolute inset-y-0 h-full w-1/2 rounded-md bg-primary transition-transform duration-300 ease-out",
              tab === "content" && "translate-x-full",
            )}
          />
          <Link
            href="/discover"
            className={cn(
              "relative z-10 flex-1 rounded-md py-2 text-center text-sm font-medium transition-colors",
              tab === "people" ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            People
          </Link>
          <Link
            href="/discover?tab=content"
            className={cn(
              "relative z-10 flex-1 rounded-md py-2 text-center text-sm font-medium transition-colors",
              tab === "content" ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            Content
          </Link>
        </div>
      </div>

      {tab === "content" ? (
        <ContentTab category={params.category} query={params.q} />
      ) : (
        <PeopleTab
          query={params.q}
          grade={params.grade}
          interest={params.interest}
          school={params.school}
        />
      )}
    </div>
  );
}

async function ContentTab({ category, query: searchQuery }: { category?: string; query?: string }) {
  const supabase = await createClient();

  let query = supabase
    .from("content_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (category && category !== "all" && VALID_CATEGORIES.has(category as ContentCategory)) {
    query = query.eq("category", category as ContentCategory);
  }
  if (searchQuery) {
    const escaped = searchQuery.replace(/[%,]/g, "");
    query = query.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
  }

  const { data: items } = await query;

  // Category links carry the current search forward: switching category
  // mid-search shouldn't silently drop it, the same expectation the
  // People tab's filter form already meets by resubmitting everything
  // together.
  const qParam = searchQuery ? `q=${encodeURIComponent(searchQuery)}` : "";

  return (
    <div>
      <form method="get" className="mt-4">
        <input type="hidden" name="tab" value="content" />
        {category && category !== "all" && <input type="hidden" name="category" value={category} />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search resources…"
            className="pl-9"
          />
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const base = c.value === "all" ? "/discover?tab=content" : `/discover?tab=content&category=${c.value}`;
          return (
            <Link
              key={c.value}
              href={qParam ? `${base}&${qParam}` : base}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-sm font-medium",
                (category ?? "all") === c.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {c.label}
            </Link>
          );
        })}
      </div>

      {!items || items.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={searchQuery ? Search : Sparkles}
          title={searchQuery ? "No matches" : "Nothing here yet"}
          description={searchQuery ? "Try a different search or category." : "Check back soon."}
        />
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <Card className="h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
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
  school,
}: {
  query?: string;
  grade?: string;
  interest?: string;
  school?: string;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const hasFilters = Boolean(query || grade || interest || school);
  const gradeNum = grade ? Number(grade) : undefined;

  const [results, suggested, newMembers] = await Promise.all([
    searchProfiles(profile.id, { query, grade: gradeNum, interest, school }),
    hasFilters ? Promise.resolve([]) : getSuggestedProfiles(profile.id, profile),
    hasFilters ? Promise.resolve([]) : getNewMembers(profile.id),
  ]);
  // Both sections independently exclude self/already-followed, but not
  // each other: a person could legitimately be both new AND a school/
  // hobby match. Dedupe so nobody's row shows up twice on the page.
  const suggestedIds = new Set(suggested.map((p) => p.id));
  const freshMembers = newMembers.filter((p) => !suggestedIds.has(p.id));

  const selectClass =
    "h-10 rounded-lg border border-border bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div>
      <Card className="mt-4 p-4">
        <form method="get" className="space-y-2">
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
          {/* Only students who've actually set a school get the option:
              a checkbox, not a full school-name dropdown, since "students at my
              own school" is the one signal worth a one-tap filter here,
              not free browsing by arbitrary school name. */}
          {profile.school && (
            <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary">
              <input
                type="checkbox"
                name="school"
                value={profile.school}
                defaultChecked={school === profile.school}
                className="sr-only"
              />
              My school only
            </label>
          )}
        </form>
      </Card>

      {!hasFilters && suggested.length > 0 && (
        <div className="mt-5">
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

      {!hasFilters && freshMembers.length > 0 && (
        <div className="mt-5">
          <h2 className="text-sm font-semibold text-muted-foreground">New to TalentZify</h2>
          <Card className="mt-2 divide-y divide-border px-4">
            {freshMembers.map((p) => (
              <ProfileRow key={p.id} profile={{ ...p, isFollowing: false }} />
            ))}
          </Card>
        </div>
      )}

      <div className="mt-5">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {hasFilters ? "Results" : "All students"}
        </h2>
        {results.length === 0 ? (
          <EmptyState
            className="mt-2"
            icon={Search}
            title="No students found"
            description="Try a different search or filter."
          />
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
