import { redirect } from "next/navigation";
import { Gift, Share2, Sparkles, UserPlus } from "lucide-react";
import { getCurrentProfile, getReferralStats } from "@/lib/data";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ReferralShareCard } from "@/components/referral-share-card";
import { timeAgo } from "@/lib/utils";

const STEPS = [
  { icon: Share2, label: "Share your link", description: "Send it to a friend, any way you like." },
  { icon: UserPlus, label: "They join", description: "Your friend signs up with your link." },
  { icon: Sparkles, label: "You both earn", description: "50 points land in both your accounts." },
];

export default async function InvitePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const { referredCount, recentReferrals } = await getReferralStats(profile.id);

  return (
    <div className="mx-auto max-w-xl space-y-4 px-4 py-6">
      <Card className="overflow-hidden p-6 text-white" style={{ background: "var(--gradient-brand)" }}>
        <Gift className="h-8 w-8" />
        <h1 className="mt-3 text-xl font-bold">Invite friends, earn points</h1>
        <p className="mt-1 text-sm text-white/85">
          Share your link. When a friend joins TalentZify with it, you both get{" "}
          <span className="font-semibold">50 points</span>.
        </p>
      </Card>

      <ReferralShareCard username={profile.username} />

      <div className="grid grid-cols-3 gap-2">
        {STEPS.map((step) => (
          <Card key={step.label} className="flex flex-col items-center gap-1.5 p-3 text-center">
            <step.icon className="h-5 w-5 text-primary" />
            <p className="text-xs font-semibold leading-tight">{step.label}</p>
            <p className="text-[11px] leading-tight text-muted-foreground">{step.description}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold leading-none">{referredCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">friends joined</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="brand-gradient-text text-2xl font-bold leading-none">{profile.referral_points}</p>
          {/* Not "points earned" — this is the combined running counter
              (both being a referrer AND being referred add to it, same
              running-counter style as profile.community_points), so it can
              be nonzero even with 0 friends joined if this account was
              itself referred. "invite points" avoids implying it's solely
              a function of the "friends joined" stat next to it. */}
          <p className="mt-1 text-xs text-muted-foreground">invite points</p>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Recent invites</h2>
        {recentReferrals.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="No invites yet"
            description="Share your link above to start earning points together."
          />
        ) : (
          <Card className="divide-y divide-border px-4">
            {recentReferrals.map((friend) => (
              <div key={friend.id} className="flex items-center gap-3 py-3">
                <Avatar name={friend.full_name} src={friend.avatar_url} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{friend.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{friend.username}</p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">{timeAgo(friend.createdAt)}</p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
