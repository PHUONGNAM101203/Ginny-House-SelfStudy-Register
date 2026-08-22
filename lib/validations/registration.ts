import { z } from "zod"
import { normalizeClassName } from "@/lib/class-name"

export const phoneRegex = /^0\d{9}$/

export const createRegistrationSchema = z.object({
  deskId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100),
  phone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  // Normalized (case/spacing/dash-insensitive — see lib/class-name.ts) so
  // "l1 04 26" and "L1-04-26" always end up stored as the same class.
  className: z.string().trim().min(1, "Vui lòng nhập tên lớp").max(100).transform(normalizeClassName),
  isRecurring: z.boolean().default(false),
})
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>

export const cancelRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().regex(phoneRegex),
})
export type CancelRegistrationInput = z.infer<typeof cancelRegistrationSchema>

/** Admin's direct cancel — no name/phone needed, the RPC's is_admin() branch skips that check entirely. */
export const adminCancelRegistrationSchema = z.object({
  registrationId: z.string().uuid(),
})
export type AdminCancelRegistrationInput = z.infer<typeof adminCancelRegistrationSchema>

// A guest's "phiếu xin xoá + đổi lịch": lower-friction than direct self-cancel
// (no exact name/phone match against the original booking required) — admin
// reviews and decides. newDeskId/newDate/newStartTime/newEndTime are all
// optional even for a "reschedule" request: a guest may just describe what
// they want in `reason` and leave the exact new slot for admin to work out.
export const requestChangeSchema = z
  .object({
    registrationId: z.string().uuid(),
    kind: z.enum(["cancel", "reschedule"]),
    requestedByName: z.string().trim().min(2, "Tên quá ngắn").max(100),
    requestedByPhone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
    reason: z.string().trim().min(1, "Vui lòng ghi lý do").max(500),
    newDeskId: z.string().uuid().optional(),
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    newStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    newEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  // The four new-slot fields travel together or not at all — a half-filled
  // target (e.g. a desk picked but no time) is ambiguous for admin to act on.
  .refine(
    (v) => {
      const filled = [v.newDeskId, v.newDate, v.newStartTime, v.newEndTime].filter((x) => x !== undefined).length
      return filled === 0 || filled === 4
    },
    { message: "Vui lòng chọn đủ chỗ và giờ mới, hoặc để trống cả hai" }
  )
export type RequestChangeInput = z.infer<typeof requestChangeSchema>

export const reviewChangeRequestSchema = z.object({
  requestId: z.string().uuid(),
  approve: z.boolean(),
  adminNote: z.string().trim().max(500).optional(),
})
export type ReviewChangeRequestInput = z.infer<typeof reviewChangeRequestSchema>
