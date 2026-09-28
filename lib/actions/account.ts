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

/** True once this account has an actual password credential — a
 * Google-only sign-up has no "email" provider identity yet. Both actions
 * below use this to decide whether a "current password" re-check is even
 * possible, the same branch app/settings/page.tsx uses to decide what to
 * render. */
function hasPasswordIdentity(user: { identities?: { provider: string }[] | null }) {
  return user.identities?.some((i) => i.provider === "email") ?? false;
}

/**
 * Changes the account's login email. Supabase sends a confirmation link
 * to the *new* address before this actually takes effect — the existing
 * app/auth/callback/route.ts already handles that link correctly with no
 * changes needed (an existing user with a profile bounces straight from
 * /onboarding to /feed?welcome=1), so this action only has to kick off
 * the change and report back.
 *
 * Re-verifies the current password first (when one exists) rather than
 * trusting the open session alone — this app is safety-conscious about
 * minors' accounts throughout, and silently letting anyone at an
 * unlocked, logged-in browser change the login email is the wrong
 * default here.
 */
export async function updateEmail(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = updateEmailSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    redirect(`/settings?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  if (hasPasswordIdentity(user)) {
    const currentPassword = formData.get("currentPassword");
    if (typeof currentPassword !== "string" || !currentPassword) {
      redirect("/settings?error=Enter your current password to confirm this change");
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });
    if (authError) {
      redirect("/settings?error=Current password is incorrect");
    }
  }

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${await siteUrl()}/auth/callback` },
  );
  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/settings?emailUpdated=1");
}

/** Changes (email-identity accounts) or sets (Google-only accounts, which
 * have none yet) the account's password. Same current-password re-check
 * as updateEmail above, skipped when there's no password to check
 * against yet. */
export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = updatePasswordSchema.safeParse({ password: formData.get("newPassword") });
  if (!parsed.success) {
    redirect(`/settings?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  if (formData.get("newPassword") !== formData.get("confirmPassword")) {
    redirect("/settings?error=New passwords don't match");
  }

  if (hasPasswordIdentity(user)) {
    const currentPassword = formData.get("currentPassword");
    if (typeof currentPassword !== "string" || !currentPassword) {
      redirect("/settings?error=Enter your current password to confirm this change");
    }
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });
    if (authError) {
      redirect("/settings?error=Current password is incorrect");
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/settings?passwordUpdated=1");
}
