"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validation";
import { parsePlatformOs, parsePlatformBrowser } from "@/lib/user-agent";
import { safeNextPath, withWelcome } from "@/lib/safe-next";

/** Refreshes the signed-in user's coarse platform on every login — see
 * lib/user-agent.ts and 0025_platform_tracking.sql. A brand-new user has
 * no profiles row yet at this point (that's only created during
 * onboarding, see lib/actions/profile.ts's completeOnboarding), so this
 * update just affects 0 rows for them — harmless, not an error. */
async function recordPlatform(userId: string) {
  const supabase = await createClient();
  const userAgent = (await headers()).get("user-agent");
  await supabase
    .from("profiles")
    .update({
      platform_os: parsePlatformOs(userAgent),
      platform_browser: parsePlatformBrowser(userAgent),
      platform_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  const host = h.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

// Failed attempts come back as state (not a redirect to ?error=) so the form
// can re-render with what they typed still in it, without the email ever
// travelling through the URL. Passwords are never echoed back.
export type SignInState = { error: string | null; email: string };
export type SignUpState = {
  error: string | null;
  accountExists: boolean;
  email: string;
  guardianAware: boolean;
};

export async function signUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const email = String(formData.get("email") ?? "");
  const guardianAware = formData.get("guardianAware") === "on";
  const fail = (error: string, accountExists = false): SignUpState => ({
    error,
    accountExists,
    email,
    guardianAware,
  });

  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    guardianAware: formData.get("guardianAware"),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { password } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return fail(error.message, error.code === "user_already_exists");
  }

  // With email confirmation on, Supabase answers a signup for an
  // already-registered address with an obfuscated user: no error, and an
  // empty identities array. Without this check they'd be told to look for
  // a confirmation email that was never sent.
  if (data.user && data.user.identities?.length === 0) {
    return fail("An account with this email already exists.", true);
  }

  // If email confirmation is required, there's no session yet.
  if (!data.session) {
    redirect("/signup?checkEmail=1");
  }

  redirect("/onboarding");
}

// Carries `next` through a failed attempt so the retry still lands on the
// page they were originally headed to.
function loginErrorUrl(message: string, next: string | null) {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", next);
  return `/login?${params.toString()}`;
}

export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const next = safeNextPath(formData.get("next"));
  const email = String(formData.get("email") ?? "");
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input", email };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: error.message, email };
  }

  if (data.user) await recordPlatform(data.user.id);

  // ?welcome=1 triggers components/brand-splash.tsx's entrance animation
  // — this redirect happens as a client-side navigation (per Next's
  // Server Action redirect behavior), so the root layout never remounts
  // for it; the query param is what lets BrandSplash notice regardless.
  // `next` is where lib/supabase/proxy.ts bounced them from, so a deep
  // link survives the login detour instead of dropping them on /feed.
  redirect(withWelcome(next ?? "/feed"));
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  const callback = `${await siteUrl()}/auth/callback`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: next ? `${callback}?next=${encodeURIComponent(withWelcome(next))}` : callback,
    },
  });

  if (error) {
    redirect(loginErrorUrl(error.message, next));
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
