"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { commentSchema, postSchema } from "@/lib/validation";
import type { ReactionType } from "@/lib/reactions";

/** Posts/likes/comments/shares render on both the feed and profile pages. */
function revalidatePostSurfaces() {
  revalidatePath("/feed");
  revalidatePath("/profile/[username]", "page");
}

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = postSchema.safeParse({
    content: formData.get("content"),
    imageUrl: formData.get("imageUrl"),
  });
  if (!parsed.success) return; // silently ignore empty submits from the feed composer

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    content: parsed.data.content,
    image_url: parsed.data.imageUrl || null,
  });

  if (!error) revalidatePostSurfaces();
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
  revalidatePostSurfaces();
}

/**
 * Sets (or clears) the current user's reaction on a post. Picking the same
 * type you already had removes it; picking a different type switches it —
 * one reaction per person per post, same as the old like button.
 */
export async function setReaction(
  postId: string,
  type: ReactionType,
  currentType: ReactionType | null,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (currentType === type) {
    await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id);
  } else if (currentType) {
    await supabase
      .from("reactions")
      .update({ reaction_type: type })
      .eq("post_id", postId)
      .eq("user_id", user.id);
  } else {
    await supabase
      .from("reactions")
      .insert({ post_id: postId, user_id: user.id, reaction_type: type });
  }

  revalidatePostSurfaces();
}

export async function toggleShare(postId: string, isShared: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isShared) {
    await supabase.from("shares").delete().eq("post_id", postId).eq("user_id", user.id);
  } else {
    await supabase.from("shares").insert({ post_id: postId, user_id: user.id });
  }

  revalidatePostSurfaces();
}

export async function addComment(postId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = commentSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return;

  await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: user.id, content: parsed.data.content });

  revalidatePostSurfaces();
}
