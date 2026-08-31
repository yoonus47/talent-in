import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { updateProfile } from "@/lib/actions/profile";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { HobbyPicker } from "@/components/hobby-picker";
import { SubmitButton } from "@/components/submit-button";
import { AvatarUpload } from "@/components/avatar-upload";
import { DeleteAccount } from "@/components/delete-account";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {saved && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">Profile updated.</p>
      )}

      <Card className="p-6">
        <SectionHeading>Photo</SectionHeading>
        <div className="mt-3">
          <AvatarUpload name={profile.full_name} avatarUrl={profile.avatar_url} />
        </div>
      </Card>

      <Card className="p-6">
        <form action={updateProfile} className="space-y-6">
          <div className="space-y-3">
            <SectionHeading>Your name</SectionHeading>
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
              <p className="text-xs text-muted-foreground">
                Usernames can&apos;t be changed in v1.
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-6">
            <SectionHeading>School</SectionHeading>
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
          </div>

          <div className="space-y-3 border-t border-border pt-6">
            <SectionHeading>About you</SectionHeading>
            <div className="space-y-1.5">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" name="bio" maxLength={280} defaultValue={profile.bio ?? ""} />
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-6">
            <SectionHeading>Hobbies & interests</SectionHeading>
            <HobbyPicker defaultSelected={profile.interests} />
          </div>

          <SubmitButton className="w-full" pendingText="Saving…">
            Save changes
          </SubmitButton>
        </form>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="outline" className="w-full">
          Log out
        </Button>
      </form>

      <Card className="border-destructive/30 p-6">
        <SectionHeading>Danger zone</SectionHeading>
        <p className="mt-2 text-sm text-muted-foreground">
          Deleting your account is permanent and can&apos;t be undone.
        </p>
        <div className="mt-3">
          <DeleteAccount />
        </div>
      </Card>
    </div>
  );
}
