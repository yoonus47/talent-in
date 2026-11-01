import Link from "next/link";
import { redirect } from "next/navigation";
import { resetPassword } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

/**
 * Only reachable with an active session. app/auth/callback/route.ts
 * exchanges the emailed reset link's code for one (a recovery session)
 * before ever landing here via its `?next=/reset-password`. No session
 * means the link was never used, already used once, or expired, so this
 * sends them back to request a fresh one rather than showing a form with
 * nothing to act on.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <Card className="w-full max-w-sm p-8">
        <Link href="/" className="brand-gradient-text mb-6 block text-center text-xl font-bold">
          TalentZify
        </Link>
        <h1 className="mb-1 text-center text-lg font-semibold">Set a new password</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Choose a new password for {user.email}.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form action={resetPassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              name="newPassword"
              required
              minLength={8}
              autoComplete="new-password"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <SubmitButton pendingText="Saving…" className="w-full">
            Save new password
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
