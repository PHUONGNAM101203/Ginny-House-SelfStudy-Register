import { z } from "zod"

export const phoneRegex = /^0\d{9}$/

export const createRegistrationSchema = z.object({
  deskId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100),
  phone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  isRecurring: z.boolean().default(false),
})
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>

export const cancelRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().regex(phoneRegex),
})
export type CancelRegistrationInput = z.infer<typeof cancelRegistrationSchema>
