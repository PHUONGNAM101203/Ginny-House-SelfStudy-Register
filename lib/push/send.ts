import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Role } from "@/types"

// Lazy, not module-top-level: this file is imported by actions/registrations.ts,
// actions/chat.ts, and the dashboard page, all on the guest/staff critical
// path. Deploying before VAPID_SUBJECT/NEXT_PUBLIC_VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY
// are configured in every environment must degrade to "push silently
// unavailable", never crash module import and take booking/chat/dashboard
// down with it.
type VapidDetails = { subject: string; publicKey: string; privateKey: string }

function readVapidDetails(): VapidDetails | null {
  const { VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env
  if (!VAPID_SUBJECT || !NEXT_PUBLIC_VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null
  return { subject: VAPID_SUBJECT, publicKey: NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }
}

// web-push's sendNotification() is deliberately not used, and
// setVapidDetails() is deliberately not called. Both paths inside the library
// run url.parse() (web-push-lib.js:274 and :348), which Node 22 reports as
// DEP0169 — "'url.parse()' behavior is not standardized and prone to errors
// that have security implications" — on stderr, so every push printed a red
// line in the Vercel function log. 3.6.7 is the latest release and still does
// it, so this goes around it rather than waiting for a fix.
//
// Everything below is the library's public API: generateRequestDetails does
// the aes128gcm encryption, getVapidHeaders signs the VAPID JWT, and the
// request goes out over fetch. Leaving currentVapidDetails unset (i.e. never
// calling setVapidDetails) is what keeps :274 from running at all — the
// library only parses the endpoint there to derive the JWT audience, which
// `new URL().origin` gives exactly.
const CONTENT_ENCODING = "aes128gcm"

async function sendWebPush(
  vapid: VapidDetails,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
): Promise<Response> {
  const audience = new URL(subscription.endpoint).origin
  const { Authorization } = webpush.getVapidHeaders(
    audience,
    vapid.subject,
    vapid.publicKey,
    vapid.privateKey,
    CONTENT_ENCODING
  )

  const details = webpush.generateRequestDetails(subscription, payload, {
    contentEncoding: CONTENT_ENCODING,
    headers: { Authorization },
  })

  const headers = new Headers()
  for (const [name, value] of Object.entries(details.headers)) {
    // fetch derives Content-Length itself and forbids setting it.
    if (name.toLowerCase() === "content-length") continue
    headers.set(name, String(value))
  }

  return fetch(details.endpoint, { method: "POST", headers, body: details.body as BodyInit })
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
  const vapid = readVapidDetails()
  if (!vapid) return
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
        const response = await sendWebPush(
          vapid,
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
        if (response.ok) {
          // Nothing reads the body, but an unread one holds the connection
          // open until the socket times out.
          await response.body?.cancel()
          return
        }

        // 404/410 = the push service says this subscription is dead (browser
        // uninstalled, site data cleared, endpoint rotated). 403 = it was
        // created against a different VAPID key pair than the server now
        // signs with, which happens whenever the keys are rotated. None of
        // the three can ever succeed again, so the row goes rather than being
        // retried on every notification for ever.
        if (response.status === 404 || response.status === 410 || response.status === 403) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id)
        }
        console.error("push send failed:", response.status, await response.text())
      } catch (error) {
        // Network failure, or a malformed subscription that encryption
        // rejects — neither says the subscription is dead, so it stays.
        console.error("push send failed:", (error as Error)?.message)
      }
    })
  )
}

