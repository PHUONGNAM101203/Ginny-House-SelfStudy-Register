"use server"

import { createPublicClient } from "@/lib/supabase/public"
import { createServerClient } from "@/lib/supabase/server"
import { requireProfile } from "@/lib/auth"
import { sendGuestChatMessageSchema, sendStaffChatMessageSchema, sendStaffRoomMessageSchema } from "@/lib/validations/chat"
import { sendPushToRole } from "@/lib/push/send"
import type { ChatMessagePayload } from "@/lib/chat-realtime"
import type { ActionResult } from "@/types"

type ChatMessageRow = { id: string; sender_role: "guest" | "staff"; body: string; created_at: string }

function toPayload(row: ChatMessageRow): ChatMessagePayload {
  return { id: row.id, senderRole: row.sender_role, body: row.body, createdAt: row.created_at }
}

// Postgres `time` columns serialize as "HH:MM:SS" over PostgREST, but
// isChatWindowOpen expects "HH:MM" — same normalization every other page
// reading a raw time column already needs (see dashboard/page.tsx's toHm).
function toHm(value: string): string {
  const [h, m] = value.split(":")
  return `${h}:${m}`
}

export type ActiveChatSessionRow = {
  sessionId: string
  id: string
  student_name: string
  class_name: string | null
  branch_name: string
  date: string
  start_time: string
  end_time: string
}

/**
 * Every currently-active chat_sessions row joined with its registration —
 * shared by the floating StaffChatWidget (polled) and the full-page
 * /noi-bo/quan-ly/chat inbox, so the query lives in one place.
 */
export async function getActiveChatSessionsAction(): Promise<ActionResult<ActiveChatSessionRow[]>> {
  await requireProfile()
  const supabase = await createServerClient()

  // Join thủ công trong TS thay vì PostgREST embed sâu — đúng quy ước đã
  // thiết lập ở trang co-so/yeu-cau-doi-lich (tránh embed-shape ambiguity).
  const { data: sessions, error } = await supabase.from("chat_sessions").select("id, registration_id, status").eq("status", "active")
  if (error) return { ok: false, error: error.message }

  const registrationIds = (sessions ?? []).map((s) => s.registration_id)
  const { data: registrations } =
    registrationIds.length > 0
      ? await supabase.from("registrations").select("id, branch_id, student_name, class_name, date, start_time, end_time").in("id", registrationIds)
      : { data: [] }

  const branchIds = [...new Set((registrations ?? []).map((r) => r.branch_id))]
  const { data: branches } = branchIds.length > 0 ? await supabase.from("branches").select("id, name").in("id", branchIds) : { data: [] }
  const branchNameById = new Map((branches ?? []).map((b) => [b.id, b.name]))

  const rows = (sessions ?? [])
    .map((s) => {
      const reg = (registrations ?? []).find((r) => r.id === s.registration_id)
      if (!reg) return null
      return {
        sessionId: s.id,
        id: reg.id,
        student_name: reg.student_name,
        class_name: reg.class_name,
        branch_name: branchNameById.get(reg.branch_id) ?? "",
        date: reg.date,
        start_time: toHm(reg.start_time),
        end_time: toHm(reg.end_time),
      }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  return { ok: true, data: rows }
}

/** Prior messages in the shared internal admin <-> quan_sinh room. */
export async function getStaffRoomHistoryAction(): Promise<ActionResult<ChatMessagePayload[]>> {
  await requireProfile()
  const supabase = await createServerClient()
  const { data: messages, error } = await supabase
    .from("staff_chat_messages")
    .select("id, sender_profile_id, sender_name, body, created_at")
    .order("created_at", { ascending: true })
  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    data: (messages ?? []).map((m) => ({
      id: m.id,
      senderRole: "staff" as const,
      senderId: m.sender_profile_id,
      senderName: m.sender_name,
      body: m.body,
      createdAt: m.created_at,
    })),
  }
}

export async function sendStaffRoomMessageAction(input: unknown): Promise<ActionResult<ChatMessagePayload>> {
  const profile = await requireProfile()
  const parsed = sendStaffRoomMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("staff_chat_messages")
    .insert({ sender_profile_id: profile.id, sender_name: profile.fullName, body: parsed.data.body })
    .select("id, created_at")
    .single()
  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    data: { id: data.id, senderRole: "staff", senderId: profile.id, senderName: profile.fullName, body: parsed.data.body, createdAt: data.created_at },
  }
}

export async function getOrCreateChatSessionAction(registrationId: string): Promise<ActionResult<{ sessionId: string }>> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("get_or_create_chat_session", { p_registration_id: registrationId })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { sessionId: data.id } }
}

/** Prior messages for a session, seen through the guest's own registration ID (see get_chat_messages, migration 0011). */
export async function getGuestChatHistoryAction(registrationId: string): Promise<ActionResult<ChatMessagePayload[]>> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("get_chat_messages", { p_registration_id: registrationId })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data as ChatMessageRow[]).map(toPayload) }
}

/** Staff reads chat_messages directly — already RLS-granted via is_staff() (migration 0007), no RPC needed. */
export async function getStaffChatHistoryAction(sessionId: string): Promise<ActionResult<ChatMessagePayload[]>> {
  await requireProfile()
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, sender_role, body, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data as ChatMessageRow[]).map(toPayload) }
}

export async function sendGuestChatMessageAction(
  input: unknown
): Promise<ActionResult<{ id: string; body: string; createdAt: string }>> {
  const parsed = sendGuestChatMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("send_guest_chat_message", {
    p_registration_id: parsed.data.registrationId,
    p_body: parsed.data.body,
  })
  if (error) return { ok: false, error: error.message }

  // Same event send_guest_chat_message (migration 0007) already writes to
  // notifications for the bell — target_role null there means every staff
  // role, matched here.
  void sendPushToRole(null, { title: "Tin nhắn chat mới", body: data.body, link: "/noi-bo/quan-ly/chat" })

  return { ok: true, data: { id: data.id, body: data.body, createdAt: data.created_at } }
}

export async function sendStaffChatMessageAction(
  input: unknown
): Promise<ActionResult<{ id: string; body: string; createdAt: string }>> {
  await requireProfile()
  const parsed = sendStaffChatMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("send_staff_chat_message", {
    p_session_id: parsed.data.sessionId,
    p_body: parsed.data.body,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { id: data.id, body: data.body, createdAt: data.created_at } }
}
