"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { postSchema } from "@/lib/validation";
import type { ReactionType } from "@/lib/reactions";
import { notify } from "@/lib/notify";
import { validateImageFile, extensionFor, storagePathFromPublicUrl } from "@/lib/uploads";
import { revalidatePostSurfaces } from "@/lib/revalidate";

const MAX_POST_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB — a bit more generous than avatars

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const parsed = postSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) return; // silently ignore empty submits from the feed composer

  // Create the post first, without the image — a photo problem (wrong
  // format, upload hiccup) must never cost the user the text they typed.
  // Previously this whole function returned early on any image failure,
  // silently dropping the entire post, text included.
  const { data: newPost, error } = await supabase
    .from("posts")
    .insert({ user_id: user.id, content: parsed.data.content, image_url: null })
    .select("id")
    .single();

  if (error || !newPost) return;

  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const validationError = validateImageFile(file, MAX_POST_IMAGE_BYTES);
    if (validationError) {
      console.error("post image rejected:", validationError);
    } else {
      const path = `${user.id}/${crypto.randomUUID()}.${extensionFor(file.type)}`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        console.error("post image upload failed:", uploadError.message);
      } else {
        const {
          data: { publicUrl },
        } = supabase.storage.from("post-images").getPublicUrl(path);
        // Dimensions come from the client (lib/image-client.ts's
        // getImageDimensions, read at picker time) — best-effort, so a
        // missing/invalid value just means PostImage falls back to a
        // default ratio rather than blocking the post entirely.
        const width = Number(formData.get("imageWidth"));
        const height = Number(formData.get("imageHeight"));
        // .select() here isn't for the data — it's the only way to tell an
        // RLS-blocked update (0 rows matched, no error) apart from a real
        // success. That gap is exactly how this shipped silently the first
        // time: the upload succeeded, the update no-opped, nothing errored.
        const { data: attached, error: attachError } = await supabase
          .from("posts")
          .update({
            image_url: publicUrl,
            image_width: Number.isFinite(width) && width > 0 ? width : null,
            image_height: Number.isFinite(height) && height > 0 ? height : null,
          })
          .eq("id", newPost.id)
          .select("id");
        if (attachError) {
          console.error("post image attach failed:", attachError.message);
        } else if (!attached || attached.length === 0) {
          console.error("post image attach affected 0 rows (RLS?) for post", newPost.id);
        }
      }
    }
  }

  revalidatePostSurfaces();
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: post } = await supabase
    .from("posts")
    .select("image_url")
    .eq("id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  await supabase.from("posts").delete().eq("id", postId).eq("user_id", user.id);

  if (post?.image_url) {
    const path = storagePathFromPublicUrl(post.image_url, "post-images");
    if (path) await supabase.storage.from("post-images").remove([path]);
  }

  revalidatePostSurfaces();
}

/**
 * Sets (or clears) the current user's reaction on a post. Picking the same
 * type you already had removes it; picking a different type switches it —
 * one reaction per person per post, same as the old like button.
 */
export async function setReaction(
  postId: string,
  authorId: string,
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
  } else {
    const { error } = currentType
      ? await supabase
          .from("reactions")
          .update({ reaction_type: type })
          .eq("post_id", postId)
          .eq("user_id", user.id)
      : await supabase
          .from("reactions")
          .insert({ post_id: postId, user_id: user.id, reaction_type: type });

    // A reaction type not yet allowed by the DB's check constraint (e.g. a
    // new type shipped in app code before its migration has been run)
    // fails right here — silently, unless logged. Learned this the hard
    // way with the "heart" reaction shipping ahead of its own migration.
    if (error) {
      console.error("setReaction failed:", error.message);
      return;
    }

    await notify(supabase, {
      recipientId: authorId,
      actorId: user.id,
      type: "reaction",
      postId,
      reactionType: type,
    });
  }

  revalidatePostSurfaces();
}

export async function toggleShare(postId: string, authorId: string, isShared: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isShared) {
    await supabase.from("shares").delete().eq("post_id", postId).eq("user_id", user.id);
  } else {
    await supabase.from("shares").insert({ post_id: postId, user_id: user.id });
    await notify(supabase, { recipientId: authorId, actorId: user.id, type: "share", postId });
  }

  revalidatePostSurfaces();
}
