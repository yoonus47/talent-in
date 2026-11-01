import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, signInWithGoogle } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-next";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  // Same guard as app/page.tsx: an already-authenticated session has no
  // business seeing a login form (it was rendering the logged-in Navbar
  // stacked above this page's own centered card, which looked broken).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  const { error, next: rawNext } = await searchParams;
  const next = safeNextPath(rawNext);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <Card className="w-full max-w-sm p-8">
        <Link href="/" className="brand-gradient-text mb-6 block text-center text-xl font-bold">
          TalentZify
        </Link>
        <h1 className="mb-1 text-center text-lg font-semibold">Welcome back</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Log in to continue building your path.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form action={signIn} className="space-y-4">
          {next && <input type="hidden" name="next" value={next} />}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              required
              autoComplete="current-password"
            />
          </div>
          <SubmitButton pendingText="Logging in…" className="w-full">
            Log in
          </SubmitButton>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form action={signInWithGoogle}>
          {next && <input type="hidden" name="next" value={next} />}
          <SubmitButton pendingText="Opening Google…" variant="outline" className="w-full">
            Continue with Google
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to TalentZify?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </Card>
    </div>
  );
}
