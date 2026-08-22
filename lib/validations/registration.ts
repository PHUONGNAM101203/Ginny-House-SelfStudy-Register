import { z } from "zod"
import { normalizeClassName } from "@/lib/class-name"

export const phoneRegex = /^0\d{9}$/

export const createRegistrationSchema = z.object({
  deskId: z.string().uuid("Chỗ không hợp lệ"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ bắt đầu không hợp lệ"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ kết thúc không hợp lệ"),
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  phone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  // Normalized (case/spacing/dash-insensitive — see lib/class-name.ts) so
  // "l1 04 26" and "L1-04-26" always end up stored as the same class.
  className: z.string().trim().min(1, "Vui lòng nhập tên lớp").max(100, "Tên lớp quá dài").transform(normalizeClassName),
  zaloContact: z.string().trim().max(50, "Nội dung quá dài").optional(),
  isRecurring: z.boolean().default(false),
})
export type CreateRegistrationInput = z.infer<typeof createRegistrationSchema>

export const cancelRegistrationSchema = z.object({
  registrationId: z.string().uuid("Lịch không hợp lệ"),
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  phone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
})
export type CancelRegistrationInput = z.infer<typeof cancelRegistrationSchema>

/** Admin's direct cancel — no name/phone needed, the RPC's is_admin() branch skips that check entirely. */
export const adminCancelRegistrationSchema = z.object({
  registrationId: z.string().uuid("Lịch không hợp lệ"),
})
export type AdminCancelRegistrationInput = z.infer<typeof adminCancelRegistrationSchema>

// A guest's "phiếu xin xoá + đổi lịch": lower-friction than direct self-cancel
// (no exact name/phone match against the original booking required) — admin
// reviews and decides. newDeskId/newDate/newStartTime/newEndTime are all
// optional even for a "reschedule" request: a guest may just describe what
// they want in `reason` and leave the exact new slot for admin to work out.
export const requestChangeSchema = z
  .object({
    registrationId: z.string().uuid("Lịch không hợp lệ"),
    kind: z.enum(["cancel", "reschedule"], { message: "Vui lòng chọn loại yêu cầu" }),
    requestedByName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
    requestedByPhone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
    reason: z.string().trim().min(1, "Vui lòng ghi lý do").max(500, "Lý do quá dài"),
    newDeskId: z.string().uuid("Chỗ không hợp lệ").optional(),
    newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ").optional(),
    newStartTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ bắt đầu không hợp lệ").optional(),
    newEndTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ kết thúc không hợp lệ").optional(),
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
  requestId: z.string().uuid("Yêu cầu không hợp lệ"),
  approve: z.boolean(),
  adminNote: z.string().trim().max(500, "Ghi chú quá dài").optional(),
})
export type ReviewChangeRequestInput = z.infer<typeof reviewChangeRequestSchema>
