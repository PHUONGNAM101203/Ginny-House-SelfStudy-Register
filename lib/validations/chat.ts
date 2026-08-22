import { z } from "zod"

export const sendGuestChatMessageSchema = z.object({
  registrationId: z.string().uuid(),
  body: z.string().trim().min(1, "Vui lòng nhập nội dung").max(1000),
})
export type SendGuestChatMessageInput = z.infer<typeof sendGuestChatMessageSchema>

export const sendStaffChatMessageSchema = z.object({
  sessionId: z.string().uuid(),
  body: z.string().trim().min(1, "Vui lòng nhập nội dung").max(1000),
})
export type SendStaffChatMessageInput = z.infer<typeof sendStaffChatMessageSchema>
