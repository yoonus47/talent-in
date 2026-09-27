"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { achievementSchema, MAX_ACHIEVEMENTS } from "@/lib/validation";
import { validateImageFile, extensionFor, storagePathFromPublicUrl } from "@/lib/uploads";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

const MAX_ACHIEVEMENT_IMAGE_BYTES = 4 * 1024 * 1024;

function parseAchievementForm(formData: FormData) {
  return achievementSchema.safeParse({
    title: formData.get("title"),
    issuer: formData.get("issuer"),
    earnedOn: formData.get("earnedOn"),
    description: formData.get("description"),
    credentialUrl: formData.get("credentialUrl"),
  });
}

/** Uploads a certificate photo to the shared post-images bucket, same
 * bucket community threads/replies already use under their own prefix
 * (0008_post_images_storage.sql's insert policy only checks the first
 * path segment is the caller's own uid, so this needs no new bucket or
 * policy). Returns null on failure — an image is optional, never worth
 * failing the whole save over. */
async function uploadAchievementImage(
  supabase: SupabaseClient<Database>,
  userId: string,
  file: File,
): Promise<string | null> {
  const validationError = validateImageFile(file, MAX_ACHIEVEMENT_IMAGE_BYTES);
  if (validationError) {
    console.error("achievement image rejected:", validationError);
    return null;
  }
  const path = `${userId}/achievements/${crypto.randomUUID()}.${extensionFor(file.type)}`;
  const { error: uploadError } = await supabase.storage
    .from("post-images")
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    console.error("achievement image upload failed:", uploadError.message);
    return null;
  }
  const {
    data: { publicUrl },
  } = supabase.storage.from("post-images").getPublicUrl(path);
  return publicUrl;
}

async function removeAchievementImage(supabase: SupabaseClient<Database>, imageUrl: string | null) {
  if (!imageUrl) return;
  const path = storagePathFromPublicUrl(imageUrl, "post-images");
  if (path) await supabase.storage.from("post-images").remove([path]);
}

// addAchievement/updateAchievement return { error } instead of redirecting,
// unlike every other action in this file's sibling profile.ts — those all
// belong to the one big always-visible Settings form, where a redirect-
// driven full reload (?saved=1) is the right unit of feedback. The
// achievements editor is its own small add/edit/list UI with real local
// state (which entry is being edited right now), called directly from a
// client event handler rather than a plain <form action>, so it needs an
// awaitable result to close its own form on success — a thrown redirect()
// would skip right past that call site's own code instead.
export type AchievementActionResult = { error?: string };

export async function addAchievement(formData: FormData): Promise<AchievementActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parseAchievementForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // A row-count cap, unlike Skills' array-length cap — nothing in the
  // schema enforces this on its own, so it's checked here explicitly.
  const { count } = await supabase
    .from("achievements")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((count ?? 0) >= MAX_ACHIEVEMENTS) {
    return { error: `You can add up to ${MAX_ACHIEVEMENTS} achievements.` };
  }

  const { title, issuer, earnedOn, description, credentialUrl } = parsed.data;

  let imageUrl: string | null = null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    imageUrl = await uploadAchievementImage(supabase, user.id, file);
  }

  const { error } = await supabase.from("achievements").insert({
    user_id: user.id,
    title,
    issuer: issuer || null,
    earned_on: earnedOn ? `${earnedOn}-01` : null,
    description: description || null,
    credential_url: credentialUrl || null,
    image_url: imageUrl,
  });
  if (error) return { error: error.message };

  revalidatePath("/edit-profile");
  revalidatePath("/profile/[username]", "page");
  return {};
}

export async function updateAchievement(id: string, formData: FormData): Promise<AchievementActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = parseAchievementForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { title, issuer, earnedOn, description, credentialUrl } = parsed.data;

  const update: Database["public"]["Tables"]["achievements"]["Update"] = {
    title,
    issuer: issuer || null,
    earned_on: earnedOn ? `${earnedOn}-01` : null,
    description: description || null,
    credential_url: credentialUrl || null,
  };

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    // Never trust a client-passed id alone for ownership — RLS already
    // enforces it, this is just so a stale/removed row's image doesn't
    // orphan Storage space, same reasoning as removeCoverFiles.
    const { data: existing } = await supabase
      .from("achievements")
      .select("image_url")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    await removeAchievementImage(supabase, existing?.image_url ?? null);
    update.image_url = await uploadAchievementImage(supabase, user.id, file);
  }

  const { error } = await supabase
    .from("achievements")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/edit-profile");
  revalidatePath("/profile/[username]", "page");
  return {};
}

export async function deleteAchievement(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existing } = await supabase
    .from("achievements")
    .select("image_url")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("achievements").delete().eq("id", id).eq("user_id", user.id);
  await removeAchievementImage(supabase, existing?.image_url ?? null);

  revalidatePath("/edit-profile");
  revalidatePath("/profile/[username]", "page");
}
