import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, getFollowersList, getProfileByUsername } from "@/lib/data";
import { ProfileRow } from "@/components/profile-row";
import { Card } from "@/components/ui/card";

export default async function FollowersPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/login");

  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const followers = await getFollowersList(profile.id, viewer.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <Link
        href={`/profile/${profile.username}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to profile
      </Link>
      <h1 className="mt-3 text-xl font-bold">{profile.full_name}&apos;s followers</h1>

      {followers.length === 0 ? (
        <Card className="mt-4 p-8 text-center text-sm text-muted-foreground">
          No followers yet.
        </Card>
      ) : (
        <Card className="mt-4 divide-y divide-border px-4">
          {followers.map((p) => (
            <ProfileRow key={p.id} profile={p} />
          ))}
        </Card>
      )}
    </div>
  );
}
