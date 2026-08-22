import { z } from "zod"

export const slotLockSchema = z.object({
  branchId: z.string().uuid("Cơ sở không hợp lệ"),
  deskId: z.string().uuid("Chỗ không hợp lệ").nullable(),
  dayOfWeek: z.number().int().min(1, "Thứ không hợp lệ").max(7, "Thứ không hợp lệ"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ bắt đầu không hợp lệ"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ kết thúc không hợp lệ"),
  reason: z.string().trim().max(200, "Lý do quá dài").optional(),
})
export type SlotLockInput = z.infer<typeof slotLockSchema>

export const DAY_LABELS: Record<number, string> = {
  1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6", 6: "Thứ 7", 7: "Chủ nhật",
}
