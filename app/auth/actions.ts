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

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    guardianAware: formData.get("guardianAware"),
  });

  if (!parsed.success) {
    redirect(
      `/signup?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`,
    );
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteUrl()}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
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

export async function signIn(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(loginErrorUrl(parsed.error.issues[0]?.message ?? "Invalid input", next));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    redirect(loginErrorUrl(error.message, next));
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
