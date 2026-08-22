"use server"

import { createPublicClient } from "@/lib/supabase/public"
import { createServerClient } from "@/lib/supabase/server"
import { requireProfile } from "@/lib/auth"
import { sendGuestChatMessageSchema, sendStaffChatMessageSchema } from "@/lib/validations/chat"
import type { ActionResult } from "@/types"

export async function getOrCreateChatSessionAction(registrationId: string): Promise<ActionResult<{ sessionId: string }>> {
  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("get_or_create_chat_session", { p_registration_id: registrationId })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: { sessionId: data.id } }
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
