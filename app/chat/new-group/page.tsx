import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile, getMutualFollowProfiles } from "@/lib/data";
import { NewGroupForm } from "@/components/new-group-form";
import { BackLink } from "@/components/back-link";

export default async function NewGroupPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const candidates = await getMutualFollowProfiles(profile.id);

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <div className="mb-4 flex items-center gap-3">
        <BackLink fallbackHref="/chat" aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <h1 className="text-lg font-bold">New group</h1>
      </div>

      <NewGroupForm candidates={candidates} />
    </div>
  );
}
