"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "@/lib/validation";
import { notify } from "@/lib/notify";

/** Follows/reactions/comments/shares render on the feed, profiles, and
 * follower/following lists — revalidate all of them after a graph change. */
function revalidateSocialSurfaces() {
  revalidatePath("/feed");
  revalidatePath("/discover");
  revalidatePath("/profile/[username]", "page");
  revalidatePath("/profile/[username]/followers", "page");
  revalidatePath("/profile/[username]/following", "page");
}

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = onboardingSchema.safeParse({
    username: formData.get("username"),
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

  const { username, grade, school, city, state, bio, interests } = parsed.data;
  const fullName = (user.user_metadata?.full_name as string | undefined) ?? "New Student";
  const isMinor = true; // v1 audience is 13-18; adjust if you add a DOB field later.

  const { error } = await supabase.from("profiles").insert({
    id: user.id,
    username,
    full_name: fullName,
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

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const parsed = onboardingSchema
    .omit({ username: true })
    .safeParse({
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

  const { grade, school, city, state, bio, interests } = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
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
  redirect("/settings?saved=1");
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
