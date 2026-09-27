import { redirect } from "next/navigation";
import { ArrowLeft, Award, GraduationCap, Heart, Link2, MessageSquare, UserRound, Zap } from "lucide-react";
import { getAchievements, getCurrentProfile } from "@/lib/data";
import { updateProfile } from "@/lib/actions/profile";
import { MAX_SKILLS } from "@/lib/validation";
import { BackLink } from "@/components/back-link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { HobbyPicker } from "@/components/hobby-picker";
import { TagInput } from "@/components/tag-input";
import { SubmitButton } from "@/components/submit-button";
import { ProfilePhotoEditor } from "@/components/profile-photo-editor";
import { AchievementsEditor } from "@/components/achievements-editor";
import type { LucideIcon } from "lucide-react";

function SectionHeading({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </h2>
  );
}

/**
 * Everything that's genuinely part of the public profile — the content a
 * visitor to /profile/[username] actually sees. Split out of what used to
 * be one big "/settings" page (still here, but now scoped to just Account:
 * Log out, delete account) because "Edit profile" and "Account settings"
 * are different mental models for a user, the same way Instagram/Twitter/
 * LinkedIn keep them as separate destinations rather than one page doing
 * both jobs.
 *
 * Organized by *save behavior*, not just topic: ProfilePhotoEditor and
 * Achievements each save themselves immediately, per photo/per entry, so
 * they bookend the page as their own independent blocks; everything in
 * between shares one "Save changes" form. Within that form, sections run
 * in the same order the profile page itself shows them (name/status/bio
 * and socials sit in the header there, School is its own About card,
 * Skills its own card) — editing in viewing order, not an arbitrary one.
 */
export default async function EditProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");
  const achievements = await getAchievements(profile.id);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      {/* No bottom-tab entry of its own (reached from the account menu or
          Profile's "Edit profile" button) — without this, the only way
          back was the browser/device back gesture. */}
      <div className="flex items-center gap-3">
        <BackLink fallbackHref={`/profile/${profile.username}`} aria-label="Back to profile">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <h1 className="text-2xl font-bold">Edit profile</h1>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {saved && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">Profile updated.</p>
      )}

      <ProfilePhotoEditor name={profile.full_name} avatarUrl={profile.avatar_url} coverUrl={profile.cover_url} />

      <form action={updateProfile} className="space-y-4">
        <Card className="space-y-3 p-6">
          <SectionHeading icon={UserRound}>Name & username</SectionHeading>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                required
                maxLength={50}
                defaultValue={profile.first_name ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                required
                maxLength={50}
                defaultValue={profile.last_name ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={`@${profile.username}`} disabled />
            <p className="text-xs text-muted-foreground">Usernames can&apos;t be changed in v1.</p>
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <SectionHeading icon={MessageSquare}>About you</SectionHeading>
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Input
              id="status"
              name="status"
              maxLength={80}
              placeholder="What are you up to right now?"
              defaultValue={profile.status ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" maxLength={280} defaultValue={profile.bio ?? ""} />
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <SectionHeading icon={Link2}>Social links</SectionHeading>
          <p className="text-xs text-muted-foreground">
            Shown on your profile. Leave any blank to hide it.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="instagramHandle">Instagram</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                id="instagramHandle"
                name="instagramHandle"
                placeholder="yourusername"
                defaultValue={profile.instagram_handle ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="youtubeHandle">YouTube</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                id="youtubeHandle"
                name="youtubeHandle"
                placeholder="yourchannel"
                defaultValue={profile.youtube_handle ?? ""}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="githubHandle">GitHub</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                id="githubHandle"
                name="githubHandle"
                placeholder="yourusername"
                defaultValue={profile.github_handle ?? ""}
              />
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <SectionHeading icon={GraduationCap}>School</SectionHeading>
          <div className="space-y-1.5">
            <Label htmlFor="grade">Grade / Class</Label>
            <select
              id="grade"
              name="grade"
              required
              defaultValue={profile.grade ?? ""}
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                <option key={g} value={g}>
                  Class {g}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="school">School</Label>
            <Input id="school" name="school" defaultValue={profile.school ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={profile.city ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={profile.state ?? ""} />
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-6">
          <SectionHeading icon={Zap}>Skills</SectionHeading>
          <p className="text-xs text-muted-foreground">
            What you&apos;re good at, separate from your hobbies below.
          </p>
          <TagInput
            name="skills"
            defaultValue={profile.skills}
            placeholder="e.g. Public Speaking, Python…"
            max={MAX_SKILLS}
          />
        </Card>

        <Card className="space-y-3 p-6">
          <SectionHeading icon={Heart}>Hobbies & interests</SectionHeading>
          <HobbyPicker defaultSelected={profile.interests} />
        </Card>

        <SubmitButton className="w-full" pendingText="Saving…">
          Save changes
        </SubmitButton>
      </form>

      {/* Its own Card, not another section inside the form above — every
          entry here is its own row with its own add/edit/delete action
          (lib/actions/achievements.ts), and nested <form>s (this
          component renders its own) aren't valid HTML, the same reason
          ProfilePhotoEditor above is a separate block too. */}
      <Card className="space-y-3 p-6">
        <SectionHeading icon={Award}>Achievements</SectionHeading>
        <p className="text-xs text-muted-foreground">
          Competitions, honors, and courses you&apos;ve completed.
        </p>
        <AchievementsEditor achievements={achievements} />
      </Card>
    </div>
  );
}
