"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({
  next,
  initialError,
}: {
  next: string | null;
  initialError: string | null;
}) {
  const [state, formAction] = useActionState(signIn, { error: initialError, email: "" });

  return (
    <>
      {state.error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={state.email}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" name="password" required autoComplete="current-password" />
        </div>
        <SubmitButton pendingText="Logging in…" className="w-full">
          Log in
        </SubmitButton>
      </form>
    </>
  );
}
