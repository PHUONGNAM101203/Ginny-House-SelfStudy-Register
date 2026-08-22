"use server"

import { createPublicClient } from "@/lib/supabase/public"
import { createServerClient } from "@/lib/supabase/server"
import { requireProfile } from "@/lib/auth"
import { sendGuestChatMessageSchema, sendStaffChatMessageSchema } from "@/lib/validations/chat"
import type { ChatMessagePayload } from "@/lib/chat-realtime"
import type { ActionResult } from "@/types"

type ChatMessageRow = { id: string; sender_role: "guest" | "staff"; body: string; created_at: string }

function toPayload(row: ChatMessageRow): ChatMessagePayload {
  return { id: row.id, senderRole: row.sender_role, body: row.body, createdAt: row.created_at }
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
