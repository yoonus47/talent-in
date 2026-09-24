"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers, cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema, profileFlairSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";
import { REFERRAL_COOKIE } from "@/lib/referrals";
import { validateImageFile, extensionFor } from "@/lib/uploads";
import { parsePlatformOs, parsePlatformBrowser } from "@/lib/user-agent";

/** Follows/reactions/comments/shares render on the feed, profiles, and
 * follower/following lists — revalidate all of them after a graph change. */
function revalidateSocialSurfaces() {
  revalidatePath("/feed");
  revalidatePath("/discover");
  revalidatePath("/profile/[username]", "page");
  revalidatePath("/profile/[username]/followers", "page");
  revalidatePath("/profile/[username]/following", "page");
}

// Throttle window for touchLastActive — matches the WHERE clause below.
const ACTIVITY_TOUCH_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Owner-side monitoring signal, not user-facing — see profiles.
 * last_active_at's own migration comment (0034_activity_and_safety_
 * monitoring.sql) for why this exists separately from platform_
 * updated_at (login-only, stale for long-lived sessions). Called from
 * app/layout.tsx on every page load; the WHERE clause makes it a 0-row
 * no-op most of the time (skips the write unless >2 minutes stale, or
 * never set), so calling it that often stays cheap regardless of
 * traffic — no separate "activity ping" endpoint or client-side timer
 * needed. `.or()` explicitly covers the NULL case too: a plain `.lt()`
 * would never match a user's very first touch, since SQL's null
 * comparisons are neither true nor false.
 */
export async function touchLastActive(userId: string) {
  const supabase = await createClient();
  const staleBefore = new Date(Date.now() - ACTIVITY_TOUCH_INTERVAL_MS).toISOString();
  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", userId)
    .or(`last_active_at.is.null,last_active_at.lt.${staleBefore}`);
}

/** Splits `user.user_metadata.full_name` (from Google) into first/last, as
 * a convenience default onboarding pre-fills — the user still sees and can
 * correct it before submitting, unlike the old silent-trust behavior. */
function splitGoogleName(fullName: unknown): { firstName: string; lastName: string } {
  if (typeof fullName !== "string" || !fullName.trim()) {
    return { firstName: "", lastName: "" };
  }
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return { firstName: first ?? "", lastName: rest.join(" ") };
}

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = onboardingSchema.safeParse({
    username: formData.get("username"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    grade: formData.get("grade"),
    school: formData.get("school"),
    city: formData.get("city"),
    state: formData.get("state"),
    bio: formData.get("bio"),
    interests: formData.getAll("interests"),
  });

  if (!parsed.success) {
    redirect(
      `/onboarding?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`,
    );
  }

  const { username, firstName, lastName, grade, school, city, state, bio, interests } =
    parsed.data;
  const fullName = `${firstName} ${lastName}`.trim();
  const isMinor = true; // v1 audience is 13-18; adjust if you add a DOB field later.

  // First and only guaranteed point a profiles row is created — the
  // natural place to capture a new user's platform for the first time.
  // See lib/user-agent.ts and 0025_platform_tracking.sql.
  const userAgent = (await headers()).get("user-agent");

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    username,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    grade,
    school: school || null,
    city: city || null,
    state: state || null,
    bio: bio || null,
    interests,
    is_minor: isMinor,
    platform_os: parsePlatformOs(userAgent),
    platform_browser: parsePlatformBrowser(userAgent),
    platform_updated_at: new Date().toISOString(),
  });

  if (error) {
    const message =
      error.code === "23505" ? "That username is taken, try another." : error.message;
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  // Referral redemption — best-effort, same posture as touchLastActive:
  // never blocks onboarding completion. Only reachable now that the
  // profiles row above actually exists (redeem_referral needs it for both
  // the referrals FK and the auth.uid()-scoped points update). See
  // supabase/migrations/0040_referral_points.sql and lib/supabase/proxy.ts
  // (which is what set this cookie, on the /signup visit itself).
  const cookieStore = await cookies();
  const refCode = cookieStore.get(REFERRAL_COOKIE)?.value;
  let referralBonus = false;
  if (refCode) {
    try {
      const { data: referrerId } = await supabase.rpc("redeem_referral", {
        p_referrer_username: refCode,
      });
      if (referrerId) {
        await notify(supabase, { recipientId: referrerId, actorId: user.id, type: "referral_joined" });
        referralBonus = true;
      }
    } catch (err) {
      console.error("redeem_referral failed:", err);
    }
    cookieStore.delete(REFERRAL_COOKIE);
  }

  revalidatePath("/feed");
  // ?welcome=1 triggers components/brand-splash.tsx's entrance animation
  // — this is the very first time a brand-new account lands on the feed.
  // ?bonus=1 additionally triggers components/referral-bonus-toast.tsx,
  // only when a referral was actually just credited.
  redirect(referralBonus ? "/feed?welcome=1&bonus=1" : "/feed?welcome=1");
}

/** Onboarding pre-fills first/last name from Google when available. */
export async function getSuggestedName(): Promise<{ firstName: string; lastName: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return splitGoogleName(user?.user_metadata?.full_name);
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = onboardingSchema
    .omit({ username: true })
    .safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      grade: formData.get("grade"),
      school: formData.get("school"),
      city: formData.get("city"),
      state: formData.get("state"),
      bio: formData.get("bio"),
      interests: formData.getAll("interests"),
    });

  if (!parsed.success) {
    redirect(
      `/settings?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`,
    );
  }

  // Separate schema, not merged into onboardingSchema — see
  // profileFlairSchema's own comment in lib/validation.ts.
  const flairParsed = profileFlairSchema.safeParse({
    status: formData.get("status"),
    skills: formData.getAll("skills"),
    instagramHandle: formData.get("instagramHandle"),
    youtubeHandle: formData.get("youtubeHandle"),
    githubHandle: formData.get("githubHandle"),
  });

  if (!flairParsed.success) {
    redirect(
      `/settings?error=${encodeURIComponent(flairParsed.error.issues[0]?.message ?? "Invalid input")}`,
    );
  }

  const { firstName, lastName, grade, school, city, state, bio, interests } = parsed.data;
  const { status, skills, instagramHandle, youtubeHandle, githubHandle } = flairParsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
      grade,
      school: school || null,
      city: city || null,
      state: state || null,
      bio: bio || null,
      interests,
      status: status || null,
      skills,
      instagram_handle: instagramHandle || null,
      youtube_handle: youtubeHandle || null,
      github_handle: githubHandle || null,
    })
    .eq("id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  revalidateSocialSurfaces();
  redirect("/settings?saved=1");
}

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB

export async function uploadAvatar(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/settings?error=${encodeURIComponent("Choose an image first.")}`);
  }

  const validationError = validateImageFile(file, MAX_AVATAR_BYTES);
  if (validationError) {
    redirect(`/settings?error=${encodeURIComponent(validationError)}`);
  }

  const path = `${user.id}/avatar.${extensionFor(file.type)}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    redirect(`/settings?error=${encodeURIComponent(uploadError.message)}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust: upsert keeps the same path, so browsers/CDNs would
  // otherwise keep showing the old image after a re-upload.
  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);

  revalidatePath("/settings");
  revalidateSocialSurfaces();
  redirect("/settings?saved=1");
}

/** Best-effort avatar cleanup — tries common extensions, ignores errors if
 * none exist. Storage objects aren't tied to Postgres foreign keys, so
 * this has to go through the actual Storage API (not a SQL DELETE — see
 * migration 0007, which reverted an attempt to do this inside the
 * delete_own_account RPC: Supabase blocks direct SQL against
 * storage.objects entirely, even from a SECURITY DEFINER function). */
async function removeAvatarFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  await supabase.storage
    .from("avatars")
    .remove(["jpeg", "png", "webp", "gif"].map((ext) => `${userId}/avatar.${ext}`));
}

export async function removeAvatar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await removeAvatarFiles(supabase, user.id);
  await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);

  revalidatePath("/settings");
  revalidateSocialSurfaces();
  redirect("/settings?saved=1");
}

const MAX_COVER_BYTES = 5 * 1024 * 1024; // 5MB — a wider image than an avatar, same reasoning

export async function uploadCover(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const file = formData.get("cover");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/settings?error=${encodeURIComponent("Choose an image first.")}`);
  }

  const validationError = validateImageFile(file, MAX_COVER_BYTES);
  if (validationError) {
    redirect(`/settings?error=${encodeURIComponent(validationError)}`);
  }

  const path = `${user.id}/cover.${extensionFor(file.type)}`;

  const { error: uploadError } = await supabase.storage
    .from("covers")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    redirect(`/settings?error=${encodeURIComponent(uploadError.message)}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("covers").getPublicUrl(path);
  // Cache-bust: upsert keeps the same path, so browsers/CDNs would
  // otherwise keep showing the old image after a re-upload.
  const coverUrl = `${publicUrl}?t=${Date.now()}`;

  await supabase.from("profiles").update({ cover_url: coverUrl }).eq("id", user.id);

  revalidatePath("/settings");
  revalidateSocialSurfaces();
  redirect("/settings?saved=1");
}

/** Mirrors removeAvatarFiles above — same reasoning, different bucket. */
async function removeCoverFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  await supabase.storage
    .from("covers")
    .remove(["jpeg", "png", "webp", "gif"].map((ext) => `${userId}/cover.${ext}`));
}

export async function removeCover() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await removeCoverFiles(supabase, user.id);
  await supabase.from("profiles").update({ cover_url: null }).eq("id", user.id);

  revalidatePath("/settings");
  revalidateSocialSurfaces();
  redirect("/settings?saved=1");
}

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await removeAvatarFiles(supabase, user.id);
  await removeCoverFiles(supabase, user.id);

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.auth.signOut();
  redirect("/?deleted=1");
}

export async function toggleFollow(targetUserId: string, isFollowing: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (isFollowing) {
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
  } else {
    await supabase
      .from("follows")
      .insert({ follower_id: user.id, following_id: targetUserId });
    await notify(supabase, { recipientId: targetUserId, actorId: user.id, type: "follow" });
  }

  revalidateSocialSurfaces();
}
