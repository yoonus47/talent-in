import { redirect } from "next/navigation";
import { completeOnboarding } from "@/lib/actions/profile";
import { getCurrentProfile } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { HobbyPicker } from "@/components/hobby-picker";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const existing = await getCurrentProfile();
  if (existing) redirect("/feed");

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold">Set up your profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        This is what other students will see. You can change it later.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="mt-6 p-6">
        <form action={completeOnboarding} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              placeholder="ananya_23"
              required
              minLength={3}
              maxLength={24}
              pattern="[a-z0-9_]+"
              title="Lowercase letters, numbers, and underscores only"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="grade">Grade / Class</Label>
            <select
              id="grade"
              name="grade"
              required
              defaultValue=""
              className="flex h-10 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="" disabled>
                Select your grade
              </option>
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
              <Input id="city" name="city" placeholder="Bengaluru" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" placeholder="Karnataka" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="school">School (optional)</Label>
            <Input id="school" name="school" placeholder="Delhi Public School" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio (optional)</Label>
            <Textarea
              id="bio"
              name="bio"
              maxLength={280}
              placeholder="What are you into? What are you working towards?"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Hobbies & Interests</Label>
            <p className="text-xs text-muted-foreground">
              Pick what you&apos;re into — this is how we connect you with people who share it.
            </p>
            <HobbyPicker />
          </div>

          <Button type="submit" className="w-full">
            Continue to TalentZify
          </Button>
        </form>
      </Card>
    </div>
  );
}
