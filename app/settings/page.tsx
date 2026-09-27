import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/data";
import { signOut } from "@/app/auth/actions";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DeleteAccount } from "@/components/delete-account";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

/**
 * Account-level actions only — Log out and deleting the account. Used to
 * also hold every public-profile field (photo, bio, skills, hobbies…),
 * which moved to its own /edit-profile page: "Edit profile" and "Account
 * settings" are different mental models for a user (LinkedIn/Instagram/
 * Twitter all keep them separate too), and cramming both into one page
 * under the ambiguous name "Settings" was the actual confusion. This page
 * keeps the URL (still reached from the account menu) but not the scope —
 * short on purpose, with obvious room for real account settings later
 * (password/email changes, notification preferences) without another
 * reshuffle.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      {/* No bottom-tab entry of its own (reached from the account menu) —
          without this, the only way back was the browser/device back
          gesture. */}
      <div className="flex items-center gap-3">
        <BackLink fallbackHref="/feed" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <h1 className="text-2xl font-bold">Account</h1>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

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
