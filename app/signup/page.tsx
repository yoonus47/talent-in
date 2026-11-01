import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { SignupForm } from "@/components/signup-form";
import { Card } from "@/components/ui/card";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ checkEmail?: string }>;
}) {
  // Same guard as app/page.tsx — signUp only ever redirects here with
  // ?checkEmail=1 while there's still no session (see app/auth/actions.ts),
  // so this can't clobber that flow; it only stops an already-logged-in
  // user from landing on a signup form under the logged-in Navbar.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  const { checkEmail } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <Card className="w-full max-w-sm p-8">
        <Link href="/" className="brand-gradient-text mb-6 block text-center text-xl font-bold">
          TalentZify
        </Link>

        {checkEmail ? (
          <div className="text-center">
            <h1 className="mb-2 text-lg font-semibold">Check your inbox</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to your email. Click it to activate your account,
              then come back and log in.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Can&apos;t find it? Check your spam or promotions folder; it can take a minute or two.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-center text-lg font-semibold">Create your account</h1>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              For Indian school students, ages 13–18.
            </p>

            <SignupForm />

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>

            <form action={signInWithGoogle}>
              <SubmitButton pendingText="Opening Google…" variant="outline" className="w-full">
                Continue with Google
              </SubmitButton>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Log in
              </Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
