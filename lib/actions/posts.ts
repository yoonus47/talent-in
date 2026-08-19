"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { commentSchema, postSchema } from "@/lib/validation";

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = postSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return; // silently ignore empty submits from the feed composer

  const { error } = await supabase
    .from("posts")
    .insert({ user_id: user.id, content: parsed.data.content });

  if (!error) revalidatePath("/feed");
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);
  revalidatePath("/feed");
}

export async function toggleLike(postId: string, isLiked: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isLiked) {
    await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
  } else {
    await supabase.from("likes").insert({ post_id: postId, user_id: user.id });
  }

  revalidatePath("/feed");
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

  revalidatePath("/feed");
}
