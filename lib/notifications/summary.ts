import { createServerClient } from "@/lib/supabase/server"
import type { Profile } from "@/types"

export type NotificationItem = {
  id: string
  type: "change_request_pending" | "missing_registration_weekly"
  title: string
  body: string | null
  link: string | null
  createdAt: string
  read: boolean
}

const MAX_ITEMS = 20

export async function getNotificationSummary(profile: Profile): Promise<{ unreadCount: number; items: NotificationItem[] }> {
  const supabase = await createServerClient()

  const [{ data: notifications }, { data: reads }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, title, body, link, created_at")
      .or(`target_role.is.null,target_role.eq.${profile.role}`)
      .order("created_at", { ascending: false })
      .limit(MAX_ITEMS),
    supabase.from("notification_reads").select("notification_id").eq("profile_id", profile.id),
  ])

  const readIds = new Set((reads ?? []).map((r) => r.notification_id))
  const items: NotificationItem[] = (notifications ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    createdAt: n.created_at,
    read: readIds.has(n.id),
  }))

  return { unreadCount: items.filter((i) => !i.read).length, items }
}
