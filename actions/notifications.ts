"use server"

import { revalidatePath } from "next/cache"
import { requireProfile } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { broadcastNotificationsUpdate } from "@/lib/notification-realtime"
import type { ActionResult } from "@/types"
import { after } from "next/server"

export async function markNotificationsReadAction(notificationIds: string[]): Promise<ActionResult<null>> {
  const profile = await requireProfile()
  if (notificationIds.length === 0) return { ok: true, data: null }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from("notification_reads")
    .upsert(
      notificationIds.map((notificationId) => ({ notification_id: notificationId, profile_id: profile.id })),
      { onConflict: "notification_id,profile_id", ignoreDuplicates: true }
    )
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo", "layout")
  return { ok: true, data: null }
}

/** Manual "xoá thông báo" — removes the row from the shared feed for every staff member, not just the caller. */
export async function deleteNotificationAction(notificationId: string): Promise<ActionResult<null>> {
  await requireProfile()
  const supabase = await createServerClient()
  const { error } = await supabase.from("notifications").delete().eq("id", notificationId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo", "layout")
  after(() => broadcastNotificationsUpdate())
  return { ok: true, data: null }
}

/**
 * "Xoá tất cả" — same shared-feed semantics as deleting one: the rows go for
 * every staff member, not just the caller. Deleting by id rather than an
 * unfiltered `.delete()`, because PostgREST rejects a delete with no filter
 * and because passing the ids the caller could actually see keeps this from
 * quietly wiping a row that arrived a second ago and nobody has read yet.
 */
export async function deleteAllNotificationsAction(notificationIds: string[]): Promise<ActionResult<{ count: number }>> {
  await requireProfile()
  if (notificationIds.length === 0) return { ok: true, data: { count: 0 } }

  const supabase = await createServerClient()
  const { error } = await supabase.from("notifications").delete().in("id", notificationIds)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo", "layout")
  after(() => broadcastNotificationsUpdate())
  return { ok: true, data: { count: notificationIds.length } }
}
