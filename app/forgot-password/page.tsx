import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "@/lib/actions/account";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

/** Same centered-card shell as app/login/page.tsx, one step removed.
 * This only ever asks for an email and hands off to requestPasswordReset,
 * which always lands back here with ?sent=1 regardless of whether the
 * address is registered (matching Supabase's own "don't reveal that"
 * behavior in the UI, not just the API). */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  const { error, sent } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <Card className="w-full max-w-sm p-8">
        <Link href="/" className="brand-gradient-text mb-6 block text-center text-xl font-bold">
          TalentZify
        </Link>
        <h1 className="mb-1 text-center text-lg font-semibold">Reset your password</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {sent ? (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-center text-sm text-primary">
            If that email has an account, a reset link is on its way. Check your inbox.
          </p>
        ) : (
          <form action={requestPasswordReset} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" autoFocus />
            </div>
            <Button type="submit" className="w-full">
              Send reset link
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to log in
        </Link>
      </Card>
    </div>
  );
}
