import { z } from "zod"

export const sendGuestChatMessageSchema = z.object({
  registrationId: z.string().uuid("Lịch không hợp lệ"),
  body: z.string().trim().min(1, "Vui lòng nhập nội dung").max(1000, "Tin nhắn quá dài"),
})
export type SendGuestChatMessageInput = z.infer<typeof sendGuestChatMessageSchema>

export const sendStaffChatMessageSchema = z.object({
  sessionId: z.string().uuid("Phiên chat không hợp lệ"),
  body: z.string().trim().min(1, "Vui lòng nhập nội dung").max(1000, "Tin nhắn quá dài"),
})
export type SendStaffChatMessageInput = z.infer<typeof sendStaffChatMessageSchema>

/** Internal admin <-> quan_sinh room — no sessionId, it's one shared room. */
export const sendStaffRoomMessageSchema = z.object({
  body: z.string().trim().min(1, "Vui lòng nhập nội dung").max(1000, "Tin nhắn quá dài"),
})
export type SendStaffRoomMessageInput = z.infer<typeof sendStaffRoomMessageSchema>
