import { z } from "zod"

export const slotLockSchema = z.object({
  branchId: z.string().uuid(),
  deskId: z.string().uuid().nullable(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(200).optional(),
})
export type SlotLockInput = z.infer<typeof slotLockSchema>

export const DAY_LABELS: Record<number, string> = {
  1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6", 6: "Thứ 7", 7: "Chủ nhật",
}
