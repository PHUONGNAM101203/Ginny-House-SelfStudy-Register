import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { createServer, type Server, type IncomingMessage } from "node:http"
import { createECDH, randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import webpush from "web-push"

/**
 * The push path used to print a red line in the Vercel function log on every
 * send:
 *
 *   (node:4) [DEP0169] DeprecationWarning: 'url.parse()' behavior is not
 *   standardized and prone to errors that have security implications.
 *
 * It came from web-push itself (web-push-lib.js:274 and :348), not from this
 * codebase, and 3.6.7 is the latest release. lib/push/send.ts goes around it
 * by using the library's encryption and VAPID helpers and sending the request
 * with fetch.
 *
 * This test holds that line: it captures process warnings across a real send
 * and fails if a deprecation warning is emitted — while also checking the
 * request that arrives is still a well-formed Web Push request, so "no
 * warning" can never be achieved by quietly sending nothing.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""

type CapturedRequest = { headers: IncomingMessage["headers"]; body: Buffer }

let server: Server
let port: number
const received: CapturedRequest[] = []
let subscriptionId: string | null = null
let profileId: string | null = null

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

beforeAll(async () => {
  // A push service stand-in. fetch honours the endpoint's scheme, so plain
  // http is enough here — web-push's own sendNotification always spoke TLS,
  // which is why an http receiver used to see nothing at all.
  server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (c: Buffer) => chunks.push(c))
    req.on("end", () => {
      received.push({ headers: req.headers, body: Buffer.concat(chunks) })
      res.writeHead(201).end()
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  port = (server.address() as { port: number }).port

  // A real subscriber keypair: a P-256 ECDH public key plus a 16-byte auth
  // secret, exactly what a browser hands over. Encryption rejects anything
  // else, so this also proves the payload really was encrypted.
  const ecdh = createECDH("prime256v1")
  ecdh.generateKeys()

  const vapidKeys = webpush.generateVAPIDKeys()
  process.env.VAPID_SUBJECT = "mailto:test@ginnyhouse.space"
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = vapidKeys.publicKey
  process.env.VAPID_PRIVATE_KEY = vapidKeys.privateKey

  // push_subscriptions.profile_id is NOT NULL and references a real profile,
  // which in turn references an auth user — so the fixture builds both.
  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email: `push-test-${randomBytes(6).toString("hex")}@example.com`,
    password: randomBytes(12).toString("base64url"),
    email_confirm: true,
  })
  if (userError || !user.user) throw userError ?? new Error("failed to create push test user")
  profileId = user.user.id
  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: profileId, full_name: "Push Test", role: "admin" })
  if (profileError) throw profileError

  const { data, error } = await admin
    .from("push_subscriptions")
    .insert({
      profile_id: profileId,
      endpoint: `http://127.0.0.1:${port}/push/test`,
      p256dh: ecdh.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    })
    .select("id")
    .single()
  if (error) throw error
  subscriptionId = data.id
})

afterAll(async () => {
  if (subscriptionId) await admin.from("push_subscriptions").delete().eq("id", subscriptionId)
  if (profileId) await admin.auth.admin.deleteUser(profileId)
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe("sendPushToRole", () => {
  it("delivers an encrypted push without emitting a deprecation warning", async () => {
    const warnings: string[] = []
    const onWarning = (warning: Error) => warnings.push(`${warning.name}: ${warning.message}`)
    process.on("warning", onWarning)

    // Imported here, after the VAPID env vars are set — the module reads them
    // per send, but importing late keeps the ordering obvious.
    const { sendPushToRole } = await import("@/lib/push/send")
    await sendPushToRole(null, { title: "Tổng kết tháng 09/2026", body: "30 lượt đăng ký", link: "/noi-bo/dashboard" })

    // Warnings are emitted on the next tick, so give them one.
    await new Promise((resolve) => setImmediate(resolve))
    process.off("warning", onWarning)

    expect(warnings.filter((w) => w.includes("Deprecation"))).toEqual([])

    expect(received).toHaveLength(1)
    const [request] = received
    expect(request.headers.authorization).toMatch(/^vapid t=/)
    expect(request.headers["content-encoding"]).toBe("aes128gcm")
    expect(request.headers["content-type"]).toBe("application/octet-stream")
    expect(request.headers.ttl).toBeDefined()
    // Encrypted, not the plain JSON that went in.
    expect(request.body.length).toBeGreaterThan(0)
    expect(request.body.toString("utf8")).not.toContain("Tổng kết")
  })
})
