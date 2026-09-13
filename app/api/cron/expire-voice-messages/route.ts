import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { storagePathFromPublicUrl } from "@/lib/uploads";
import type { Database } from "@/lib/types/database";

/**
 * Deletes free-tier voice messages older than 60 days — both the Storage
 * object and the messages row. This has to be a Node-side job, not a SQL
 * function: Supabase blocks direct `delete from storage.objects` even from
 * a SECURITY DEFINER function ("Direct deletion from storage tables is not
 * allowed. Use the Storage API instead" — found via live testing, see
 * 0007_fix_delete_own_account.sql, which hit exactly this deleting
 * avatars). So this route uses the service-role client's `.storage
 * .remove()`, the same mechanism removeAvatarFiles/removeGroupIconFiles
 * already use elsewhere in this app.
 *
 * Amplify has no built-in cron (unlike Vercel) — point an external
 * scheduler (a free service like cron-job.org, or an AWS EventBridge
 * Scheduler → API destination) at this route on a daily-ish cadence, with
 * the same CRON_SECRET value in the `x-cron-secret` header.
 *
 * Sender's tier is evaluated at cleanup time (not snapshotted at send
 * time) — by design: a downgrade makes a user's *existing* notes older
 * than 60 days eligible on the next run, not just future ones.
 */

const BATCH_SIZE = 500;
const RETENTION_DAYS = 60;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // `!inner` turns the embed into a join, letting us filter on the
  // embedded profile's column (sender.tier) via PostgREST's dot notation —
  // a plain (non-inner) embed can't be filtered on this way.
  const { data: expired, error } = await supabase
    .from("messages")
    .select("id, audio_url, sender:profiles!messages_sender_id_fkey!inner(tier)")
    .eq("type", "voice")
    .lt("created_at", cutoff)
    .eq("sender.tier", "free")
    .limit(BATCH_SIZE);

  if (error) {
    console.error("expire-voice-messages query failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!expired || expired.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const paths = expired
    .map((m) => (m.audio_url ? storagePathFromPublicUrl(m.audio_url, "voice-messages") : null))
    .filter((p): p is string => p !== null);

  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from("voice-messages").remove(paths);
    // Not fatal — .remove() on an already-missing object isn't an error
    // either, so a retry after a partial prior failure is safe. Still
    // delete the rows below even if this somehow errors, rather than
    // leaving expired messages visible forever because of a Storage hiccup.
    if (removeError) console.error("expire-voice-messages storage cleanup failed:", removeError.message);
  }

  const ids = expired.map((m) => m.id);
  const { error: deleteError } = await supabase.from("messages").delete().in("id", ids);
  if (deleteError) {
    console.error("expire-voice-messages row cleanup failed:", deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: ids.length });
}
