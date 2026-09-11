"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUnreadMessageCount } from "@/lib/data";

/**
 * Fresh unread-conversations count, callable from the client. Same
 * staleness escape hatch as fetchUnreadNotificationCount
 * (lib/actions/notifications.ts) — see its comment — used by
 * components/chat-fab-button.tsx.
 */
export async function fetchUnreadMessageCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  return getUnreadMessageCount(user.id);
}

/**
 * Starts (or resumes) a conversation with `otherUserId` and redirects into
 * it. Thin wrapper around the start_dm_conversation RPC
 * (0019_group_chats.sql) — that function is the real guard (mutual-follow
 * check + atomic find-or-create + membership rows), not this action.
 */
export async function startConversation(otherUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (otherUserId === user.id) return;

  const { data: conversationId, error } = await supabase.rpc("start_dm_conversation", {
    p_other_id: otherUserId,
  });

  if (error || !conversationId) {
    console.error("startConversation failed:", error?.message);
    return;
  }

  redirect(`/chat/${conversationId}`);
}

/**
 * Creates a group with `memberIds` (plus the caller) and redirects into
 * it. Thin wrapper around create_group_conversation — see that function
 * for the real validation (name, member cap, mutual-follow-per-member).
 */
export async function createGroupConversation(name: string, memberIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conversationId, error } = await supabase.rpc("create_group_conversation", {
    p_name: name,
    p_member_ids: memberIds,
  });

  if (error || !conversationId) {
    return { error: error?.message ?? "Could not create group." };
  }

  redirect(`/chat/${conversationId}`);
}

/** Admin-only — see add_group_members for the real guard. */
export async function addGroupMembers(conversationId: string, memberIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("add_group_members", {
    p_conversation_id: conversationId,
    p_member_ids: memberIds,
  });

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

/** Admin-only — RLS (the group-rename policy in 0019_group_chats.sql) is
 * the real guard; a non-admin's update just matches zero rows. */
export async function renameGroupConversation(conversationId: string, name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 60) {
    return { error: "Group name must be 1-60 characters." };
  }

  const { error } = await supabase
    .from("conversations")
    .update({ name: trimmed })
    .eq("id", conversationId);

  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Removes the caller's own membership row and sends them back to the
 * conversation list — their thread page's RLS access is gone the instant
 * this commits, so leaving them on it would just start silently failing.
 */
export async function leaveGroup(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);

  redirect("/chat");
}

/** Admin-only removal of another member — same delete policy as leaving,
 * just targeting someone else's row. */
export async function removeGroupMember(conversationId: string, memberId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase
    .from("conversation_members")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", memberId);
}

/**
 * Marks a conversation read as of now, for the current user only. Called
 * both directly during the thread page's render (on open) and as a client
 * Server Action call (when a realtime message arrives while the thread is
 * open) — no revalidatePath here, since /chat and /chat/[id] are already
 * fully dynamic (cookies()-based) and re-fetch fresh on every navigation;
 * calling it from a page's render is what a bare Server Action call
 * actually needs to support (revalidatePath explicitly can't run there).
 */
export async function markConversationRead(conversationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("conversation_reads")
    .upsert(
      { conversation_id: conversationId, user_id: user.id, last_read_at: new Date().toISOString() },
      { onConflict: "conversation_id,user_id" },
    );
}

/** Ownership-checked delete — "unsend" — mirrors deleteComment. */
export async function deleteMessage(messageId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("messages").delete().eq("id", messageId).eq("sender_id", user.id);
}
