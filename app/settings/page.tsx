import { redirect } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { getCurrentProfile } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { BackLink } from "@/components/back-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoginSecurityCard } from "@/components/login-security-card";
import { DeleteAccount } from "@/components/delete-account";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

/**
 * Account-level actions only: login credentials, logging out, deleting
 * the account. Used to also hold every public-profile field (photo, bio,
 * skills, hobbies…), which moved to its own /edit-profile page: "Edit
 * profile" and "Account settings" are different mental models for a user
 * (LinkedIn/Instagram/Twitter all keep them separate too), and cramming
 * both into one page under the ambiguous name "Settings" was the actual
 * confusion. This page keeps the URL (still reached from the account
 * menu) but not the scope.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    context?: string;
    emailUpdated?: string;
    passwordUpdated?: string;
  }>;
}) {
  const { error, context, emailUpdated, passwordUpdated } = await searchParams;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // A Google-only sign-up has no "email" provider identity. Its email
  // and password are both managed by Google, not by us. Changing a
  // password here would be a login method these kids never chose to
  // have, so neither field below applies: email renders read-only, and
  // the password form doesn't render at all (see lib/actions/account.ts's
  // updatePassword, which refuses this server-side too, not just here).
  const hasPassword = user.identities?.some((i) => i.provider === "email") ?? false;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
      {/* No bottom-tab entry of its own (reached from the account menu).
          Without this, the only way back was the browser/device back
          gesture. */}
      <div className="flex items-center gap-3">
        <BackLink fallbackHref="/feed" aria-label="Back">
          <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
        </BackLink>
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {emailUpdated && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          Check your new email to confirm the change. It won&apos;t take effect until you click
          the link.
        </p>
      )}
      {passwordUpdated && (
        <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">Password updated.</p>
      )}

      <Card className="space-y-4 p-6">
        <SectionHeading>
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Login & security
          </span>
        </SectionHeading>

        <LoginSecurityCard
          email={user.email ?? ""}
          hasPassword={hasPassword}
          defaultEditingEmail={context === "email"}
          defaultChangingPassword={context === "password"}
        />
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
