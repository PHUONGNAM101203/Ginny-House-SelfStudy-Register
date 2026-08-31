// Same fixed-channel Broadcast pattern as chat-realtime.ts's staff-inbox —
// a plain page-load poll would leave the bell stale for up to a full
// navigation; broadcasting on every notification-affecting event instead
// makes the badge/list update the instant something happens, using
// Supabase Realtime's own delivery rather than a client-side interval that
// would otherwise be the "cron" the ask referred to.
import { createBrowserClient } from "@/lib/supabase/client"
import { createAdminClient } from "@/lib/supabase/admin"

const NOTIFICATIONS_CHANNEL = "notifications:inbox"
const UPDATE_EVENT = "inbox_update"

export function subscribeToNotifications(onUpdate: () => void): () => void {
  const supabase = createBrowserClient()
  const channel = supabase
    .channel(NOTIFICATIONS_CHANNEL)
    .on("broadcast", { event: UPDATE_EVENT }, () => onUpdate())
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Called from Server Actions / Server Components after any mutation that
 * creates, resolves, or deletes a notification row. Uses the admin client
 * (not the anon/authenticated request-scoped client) because this runs in
 * a server context with no active browser websocket to piggyback on —
 * Realtime Broadcast's HTTP fallback works over a plain REST call, no
 * subscribe needed to send.
 */
export async function broadcastNotificationsUpdate(): Promise<void> {
  const admin = createAdminClient()
  const channel = admin.channel(NOTIFICATIONS_CHANNEL)
  await channel.send({ type: "broadcast", event: UPDATE_EVENT, payload: {} })
  admin.removeChannel(channel)
}
