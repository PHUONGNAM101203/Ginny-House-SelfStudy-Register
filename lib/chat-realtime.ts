// Dùng Broadcast (không phải Postgres Changes) vì guest truy cập bằng anon
// key, không có auth.uid() riêng để RLS lọc theo từng session khi
// subscribe qua Postgres Changes. Tên kênh chứa session_id (UUID không
// đoán được) đóng vai trò "vé vào phòng" — ai gửi tin nhắn (qua RPC, xem
// actions/chat.ts) cũng đồng thời broadcast lên đúng kênh này để phía còn
// lại nhận theo thời gian thực.
import { createBrowserClient } from "@/lib/supabase/client"

export type ChatMessagePayload = {
  id: string
  senderRole: "guest" | "staff"
  /**
   * Profile id of the sender — only present for staff messages. Needed for
   * the internal staff room (admin ↔ quan_sinh): both sides are literally
   * senderRole "staff", so "is this my own message" can't be decided by
   * role alone there — see ChatThread's ownership check.
   */
  senderId?: string
  /** Display name for a staff sender — shown as a small label in the staff room, where knowing *which* staff member said something matters. */
  senderName?: string
  body: string
  createdAt: string
}

const CHANNEL_EVENT = "new_message"

// "staff-room" (not a UUID) is a valid, fixed channel id for the shared
// internal chat — same helper as per-registration session channels, just a
// different kind of "room" identifier.
function channelName(sessionId: string): string {
  return `chat:${sessionId}`
}

export function subscribeToChatChannel(sessionId: string, onMessage: (msg: ChatMessagePayload) => void): () => void {
  const supabase = createBrowserClient()
  const channel = supabase
    .channel(channelName(sessionId))
    .on("broadcast", { event: CHANNEL_EVENT }, ({ payload }) => onMessage(payload as ChatMessagePayload))
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function broadcastChatMessage(sessionId: string, message: ChatMessagePayload): Promise<void> {
  const supabase = createBrowserClient()
  const channel = supabase.channel(channelName(sessionId))
  await channel.send({ type: "broadcast", event: CHANNEL_EVENT, payload: message })
  supabase.removeChannel(channel)
}

// A fixed channel (not session-scoped) so StaffChatWidget's active-session
// list/badge updates the moment a guest opens a chat or sends a message,
// instead of waiting for its 30s poll — staff should always see a waiting
// guest as soon as they show up, not on a delay. "staff-inbox" can never
// collide with a real session_id (those are UUIDs).
const STAFF_INBOX_CHANNEL = "chat:staff-inbox"
const INBOX_EVENT = "inbox_update"

export function subscribeToStaffInbox(onUpdate: () => void): () => void {
  const supabase = createBrowserClient()
  const channel = supabase
    .channel(STAFF_INBOX_CHANNEL)
    .on("broadcast", { event: INBOX_EVENT }, () => onUpdate())
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function broadcastStaffInboxUpdate(): Promise<void> {
  const supabase = createBrowserClient()
  const channel = supabase.channel(STAFF_INBOX_CHANNEL)
  await channel.send({ type: "broadcast", event: INBOX_EVENT, payload: {} })
  supabase.removeChannel(channel)
}
