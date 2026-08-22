"use server"

import { requireProfile } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { subscribeToPushSchema, unsubscribeFromPushSchema } from "@/lib/validations/push"
import type { ActionResult } from "@/types"

export async function subscribeToPushAction(input: unknown): Promise<ActionResult<null>> {
  const profile = await requireProfile()
  const parsed = subscribeToPushSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  // onConflict endpoint: re-subscribing the same device (e.g. after
  // reinstalling the PWA) just re-points it at the current profile rather
  // than erroring on the unique constraint.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { profile_id: profile.id, endpoint: parsed.data.endpoint, p256dh: parsed.data.p256dh, auth: parsed.data.auth },
      { onConflict: "endpoint" }
    )
  if (error) return { ok: false, error: error.message }

  return { ok: true, data: null }
}

export async function unsubscribeFromPushAction(input: unknown): Promise<ActionResult<null>> {
  await requireProfile()
  const parsed = unsubscribeFromPushSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint)
  if (error) return { ok: false, error: error.message }

  return { ok: true, data: null }
}
