import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Role } from "@/types"

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export type PushPayload = { title: string; body?: string; link?: string }

/**
 * Fire-and-forget from the caller's perspective — a push failure (expired
 * subscription, network error, browser push service down) must never break
 * the mutation it's attached to (a guest's chat message still has to send
 * even if nobody has push enabled yet). Callers just `void sendPushToRole(...)`.
 *
 * `targetRole: null` matches this app's existing notifications.target_role
 * convention (migration 0006) — null means every internal role, not "nobody".
 */
export async function sendPushToRole(targetRole: Role | null, payload: PushPayload): Promise<void> {
  const admin = createAdminClient()

  let profileIds: string[] | null = null
  if (targetRole) {
    const { data: profiles } = await admin.from("profiles").select("id").eq("role", targetRole)
    profileIds = (profiles ?? []).map((p) => p.id)
    if (profileIds.length === 0) return
  }

  let query = admin.from("push_subscriptions").select("id, endpoint, p256dh, auth")
  if (profileIds) query = query.in("profile_id", profileIds)
  const { data: subscriptions } = await query
  if (!subscriptions || subscriptions.length === 0) return

  const body = JSON.stringify(payload)
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body)
      } catch (error) {
        // 404/410 = the push service itself says this subscription is dead
        // (browser uninstalled, site data cleared, endpoint rotated) — clean
        // it up so future sends don't keep paying for a doomed request.
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id)
        }
      }
    })
  )
}
