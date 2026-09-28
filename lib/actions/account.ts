"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { updateEmailSchema, updatePasswordSchema } from "@/lib/validation";

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

/** True once this account has an actual password credential: a
 * Google-only sign-up has no "email" provider identity. Both actions
 * below refuse to run at all without one (their email/password is
 * Google's to manage, not ours), the same check app/settings/page.tsx
 * uses to decide whether to render these forms in the first place. */
function hasPasswordIdentity(user: { identities?: { provider: string }[] | null }) {
  return user.identities?.some((i) => i.provider === "email") ?? false;
}

/** Both forms on the settings page are collapsed until the user opts in
 * to changing something (see components/login-security-card.tsx). On a
 * validation failure, `context` tells the page which one to re-expand so
 * the error lands next to the fields it's actually about, instead of a
 * banner above two closed sections with no obvious form to retry in. */
function failWith(context: "email" | "password", message: string): never {
  redirect(`/settings?context=${context}&error=${encodeURIComponent(message)}`);
}

/**
 * Changes the account's login email. Supabase sends a confirmation link
 * to the *new* address before this actually takes effect. The existing
 * app/auth/callback/route.ts already handles that link correctly with no
 * changes needed (an existing user with a profile bounces straight from
 * /onboarding to /feed?welcome=1), so this action only has to kick off
 * the change and report back.
 *
 * A Google-only account's email is managed by Google, not us. The page
 * never renders a form that could submit this for one, but this refuses
 * it server-side too rather than relying on the UI alone.
 *
 * Re-verifies the current password first: this app is safety-conscious
 * about minors' accounts throughout, and silently letting anyone at an
 * unlocked, logged-in browser change the login email is the wrong
 * default here.
 */
export async function updateEmail(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!hasPasswordIdentity(user)) {
    failWith("email", "Your account email is managed by Google");
  }

  const parsed = updateEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    failWith("email", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const currentPassword = formData.get("currentPassword");
  if (typeof currentPassword !== "string" || !currentPassword) {
    failWith("email", "Enter your current password to confirm this change");
  }
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });
  if (authError) {
    failWith("email", "Current password is incorrect");
  }

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${await siteUrl()}/auth/callback` },
  );
  if (error) {
    failWith("email", error.message);
  }

  redirect("/settings?emailUpdated=1");
}

/**
 * Changes the account's password. Google-only accounts don't get one
 * through us at all: their password is Google's to manage, and giving
 * kids a second, easy-to-forget login method to juggle is unnecessary
 * complexity, not a feature. The page never renders this form for one,
 * and this refuses it server-side too rather than relying on the UI alone.
 */
export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!hasPasswordIdentity(user)) {
    failWith("password", "Your account password is managed by Google");
  }

  const parsed = updatePasswordSchema.safeParse({ password: formData.get("newPassword") });
  if (!parsed.success) {
    failWith("password", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (formData.get("newPassword") !== formData.get("confirmPassword")) {
    failWith("password", "New passwords don't match");
  }

  const currentPassword = formData.get("currentPassword");
  if (typeof currentPassword !== "string" || !currentPassword) {
    failWith("password", "Enter your current password to confirm this change");
  }
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });
  if (authError) {
    failWith("password", "Current password is incorrect");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    failWith("password", error.message);
  }

  redirect("/settings?passwordUpdated=1");
}

/**
 * Kicks off the "forgot password" flow. Always redirects to the same
 * "check your email" state regardless of whether the address is
 * actually registered (Supabase itself already doesn't reveal that
 * either way, so this just matches it in the UI rather than leaking it
 * back out through a different error path).
 */
export async function requestPasswordReset(formData: FormData) {
  const parsed = updateEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/forgot-password?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
  });

  redirect("/forgot-password?sent=1");
}

/**
 * Sets a new password from the "forgot password" recovery link.
 * app/reset-password/page.tsx only renders this form once
 * app/auth/callback/route.ts has already exchanged the emailed link's
 * code for a session, so no current-password check here: the recovery
 * session itself *is* the proof of identity, unlike updatePassword
 * above (an in-session change, where the current password is the proof).
 */
export async function resetPassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/forgot-password");

  const parsed = updatePasswordSchema.safeParse({ password: formData.get("newPassword") });
  if (!parsed.success) {
    redirect(`/reset-password?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  if (formData.get("newPassword") !== formData.get("confirmPassword")) {
    redirect("/reset-password?error=New passwords don't match");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/feed");
}
