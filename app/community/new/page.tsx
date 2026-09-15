import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCommunityTopics, getCurrentProfile } from "@/lib/data";
import { NewThreadForm } from "@/components/new-thread-form";
import { BackLink } from "@/components/back-link";

export default async function NewCommunityThreadPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const { topic: topicSlug } = await searchParams;
  const topics = await getCommunityTopics();
  const defaultTopic = topicSlug ? topics.find((t) => t.slug === topicSlug) : undefined;

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <BackLink fallbackHref="/community" aria-label="Back to community">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <h1 className="text-lg font-bold">New thread</h1>
      </div>

      {topics.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No topics yet. Run <code className="rounded bg-muted px-1.5 py-0.5">
            supabase/migrations/0028_community.sql
          </code>{" "}
          against your project.
        </p>
      ) : (
        <NewThreadForm topics={topics} defaultTopicId={defaultTopic?.id} />
      )}
    </div>
  );
}
