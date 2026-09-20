import { ArrowLeft, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, getFollowingList, getProfileByUsername } from "@/lib/data";
import { ProfileRow } from "@/components/profile-row";
import { BackLink } from "@/components/back-link";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export default async function FollowingPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/login");

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const following = await getFollowingList(profile.id, viewer.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <BackLink
        fallbackHref={`/profile/${profile.username}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to profile
      </BackLink>
      <h1 className="mt-3 text-xl font-bold">{profile.full_name} follows</h1>

      {following.length === 0 ? (
        <EmptyState className="mt-4" icon={Users} title="Not following anyone yet" />
      ) : (
        <Card className="mt-4 divide-y divide-border px-4">
          {following.map((p) => (
            <ProfileRow key={p.id} profile={p} />
          ))}
        </Card>
      )}
    </div>
  );
}
