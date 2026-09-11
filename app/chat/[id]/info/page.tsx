import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, getGroupInfo, getMutualFollowProfiles } from "@/lib/data";
import { GroupInfoPanel } from "@/components/group-info-panel";

export default async function GroupInfoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getCurrentProfile();
  if (!viewer) redirect("/onboarding");

  const groupInfo = await getGroupInfo(id);
  if (!groupInfo) notFound();

  // getGroupInfo already RLS-scopes to members, but a member list doesn't
  // by itself tell us the *viewer's own* role — find it explicitly.
  const viewerMembership = groupInfo.members.find((m) => m.id === viewer.id);
  if (!viewerMembership) notFound();

  const mutualFollows = await getMutualFollowProfiles(viewer.id);
  const memberIds = new Set(groupInfo.members.map((m) => m.id));
  const addableCandidates = mutualFollows.filter((p) => !memberIds.has(p.id));

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <GroupInfoPanel
        conversationId={id}
        groupInfo={groupInfo}
        viewerId={viewer.id}
        isAdmin={viewerMembership.role === "admin"}
        addableCandidates={addableCandidates}
      />
    </div>
  );
}
