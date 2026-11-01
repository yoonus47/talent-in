"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm() {
  const [state, formAction] = useActionState(signUp, {
    error: null,
    accountExists: false,
    email: "",
    guardianAware: false,
  });

  return (
    <>
      {state.error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
          {state.accountExists && (
            <>
              {" "}
              <Link href="/login" className="font-medium underline">
                Log in
              </Link>{" "}
              instead, or{" "}
              <Link href="/forgot-password" className="font-medium underline">
                reset your password
              </Link>
              . If you joined with Google, use Continue with Google.
            </>
          )}
        </p>
      )}

      <form action={formAction} className="space-y-4">
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
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="guardianAware"
            required
            defaultChecked={state.guardianAware}
            className="mt-0.5 h-4 w-4 rounded border-border"
          />
          A parent or guardian is aware I&apos;m creating this account.
        </label>
        <p className="text-xs text-muted-foreground">
          By signing up, you agree to our{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Terms
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
        <SubmitButton pendingText="Creating account…" className="w-full">
          Sign up
        </SubmitButton>
      </form>
    </>
  );
}
