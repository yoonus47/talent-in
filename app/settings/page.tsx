import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data";
import { updateProfile } from "@/lib/actions/profile";
import { signOut } from "@/app/auth/actions";
import { INTEREST_OPTIONS } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { error, saved } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p className="mt-4 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          Profile updated.
        </p>
      )}

      <Card className="mt-4 p-6">
        <form action={updateProfile} className="space-y-5">
          <div className="space-y-1.5">
            <Label>Username</Label>
            <Input value={`@${profile.username}`} disabled />
            <p className="text-xs text-muted-foreground">Usernames can&apos;t be changed in v1.</p>
          </div>

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

          <div className="space-y-1.5">
            <Label htmlFor="school">School</Label>
            <Input id="school" name="school" defaultValue={profile.school ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" maxLength={280} defaultValue={profile.bio ?? ""} />
          </div>

          <div className="space-y-1.5">
            <Label>Interests</Label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((interest) => (
                <label
                  key={interest}
                  className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary"
                >
                  <input
                    type="checkbox"
                    name="interests"
                    value={interest}
                    defaultChecked={profile.interests.includes(interest)}
                    className="sr-only"
                  />
                  {interest}
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full">
            Save changes
          </Button>
        </form>
      </Card>

      <form action={signOut} className="mt-4">
        <Button type="submit" variant="outline" className="w-full">
          Log out
        </Button>
      </form>
    </div>
  );
}
