"use server"

import { revalidatePath } from "next/cache"
import { requireProfile } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import type { ActionResult } from "@/types"

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
