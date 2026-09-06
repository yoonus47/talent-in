import { getCurrentProfile, getUnreadMessageCount } from "@/lib/data";
import { ChatFabButton } from "@/components/chat-fab-button";

/** Server-fetches the unread count; same top-level guard as Navbar
 * (renders nothing when logged out). Rendered once in the root layout,
 * alongside ThemeToggle, so it's available on every page. */
export async function ChatFab() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const unreadCount = await getUnreadMessageCount(profile.id);

  return <ChatFabButton userId={profile.id} unreadCount={unreadCount} />;
}
