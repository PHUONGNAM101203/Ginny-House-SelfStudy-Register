import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Role } from "@/types"

// Lazy, not module-top-level: this file is imported by actions/registrations.ts,
// actions/chat.ts, and the dashboard page, all on the guest/staff critical
// path. Deploying before VAPID_SUBJECT/NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY
// are configured in every environment must degrade to "push silently
// unavailable", never crash module import and take booking/chat/dashboard
// down with it.
let vapidConfigured = false
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false
  webpush.setVapidDetails(VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  vapidConfigured = true
  return true
}

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
  if (!ensureVapidConfigured()) return
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
        // 404/410 = the push service says this subscription is dead. 403 =
        // it was created against a different VAPID key pair than the server
        // now signs with, which happens whenever the keys are rotated — the
        // subscription can never succeed again, so it goes too rather than
        // being retried on every notification for ever.
        if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id)
        }
        console.error("push send failed:", statusCode, (error as Error)?.message)
      }
    })
  )
}


export type PushDiagnostic = {
  endpointHost: string
  ok: boolean
  statusCode?: number
  message?: string
}

/**
 * Sends a push to one specific subscription and reports what the push service
 * actually said, instead of swallowing it like sendPushToRole does.
 *
 * Exists because "the phone doesn't buzz" has several causes that look
 * identical from the server — an expired subscription, a VAPID key rotated
 * out from under it, iOS refusing web push to a site that isn't installed to
 * the Home Screen, or the OS simply muting it. This turns the guess into a
 * status code from the device's own push service.
 */
export async function sendTestPush(endpoint: string): Promise<PushDiagnostic> {
  const host = (() => {
    try {
      return new URL(endpoint).host
    } catch {
      return "endpoint không hợp lệ"
    }
  })()

  if (!ensureVapidConfigured()) {
    return { endpointHost: host, ok: false, message: "Máy chủ chưa cấu hình VAPID" }
  }

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("endpoint", endpoint)
    .maybeSingle()

  if (!sub) {
    return { endpointHost: host, ok: false, message: "Thiết bị này chưa đăng ký nhận thông báo trên máy chủ" }
  }

  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify({ title: "Ginny House", body: "Thông báo thử — nếu bạn thấy tin này là đã chạy đúng.", link: "/noi-bo/lich" })
    )
    return { endpointHost: host, ok: true }
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
      await admin.from("push_subscriptions").delete().eq("id", sub.id)
    }
    return {
      endpointHost: host,
      ok: false,
      statusCode,
      message: (error as Error)?.message?.slice(0, 200),
    }
  }
}
