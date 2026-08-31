"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";
import { validateImageFile, extensionFor } from "@/lib/uploads";

/** Follows/reactions/comments/shares render on the feed, profiles, and
 * follower/following lists — revalidate all of them after a graph change. */
function revalidateSocialSurfaces() {
  revalidatePath("/feed");
  revalidatePath("/discover");
  revalidatePath("/profile/[username]", "page");
  revalidatePath("/profile/[username]/followers", "page");
  revalidatePath("/profile/[username]/following", "page");
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
  });

  if (error) {
    const message =
      error.code === "23505" ? "That username is taken, try another." : error.message;
    redirect(`/onboarding?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/feed");
  redirect("/feed");
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

  const { firstName, lastName, grade, school, city, state, bio, interests } = parsed.data;

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

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await removeAvatarFiles(supabase, user.id);

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
