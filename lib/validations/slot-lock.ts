import { z } from "zod"

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ")
const hm = (label: string) => z.string().regex(/^\d{2}:\d{2}$/, `${label} không hợp lệ`)

/**
 * Three ways to say when a lock applies. They collapse into the same row
 * (see migration 0041 and lib/slot-locks.ts); the mode exists so the form can
 * ask one clear question instead of showing three nullable fields and hoping.
 *
 * "date" comes first because it is the common case — a buổi thi thử, a power
 * cut, a one-off event. Locking every Thứ 7 for ever is the rarer, heavier
 * choice and now has to be picked deliberately.
 */
export const SLOT_LOCK_MODES = ["date", "range", "weekly"] as const
export type SlotLockMode = (typeof SLOT_LOCK_MODES)[number]

const base = {
  branchId: z.string().uuid("Cơ sở không hợp lệ"),
  deskId: z.string().uuid("Chỗ không hợp lệ").nullable(),
  startTime: hm("Giờ bắt đầu"),
  endTime: hm("Giờ kết thúc"),
  reason: z.string().trim().max(200, "Lý do quá dài").optional(),
}

export const slotLockSchema = z
  .discriminatedUnion("mode", [
    // Một ngày cụ thể
    z.object({ ...base, mode: z.literal("date"), date: ymd }),
    // Một khoảng ngày
    z.object({ ...base, mode: z.literal("range"), from: ymd, to: ymd }),
    // Lặp lại theo thứ, như trước
    z.object({
      ...base,
      mode: z.literal("weekly"),
      dayOfWeek: z.number().int().min(1, "Thứ không hợp lệ").max(7, "Thứ không hợp lệ"),
    }),
  ])
  .refine((v) => v.endTime > v.startTime, {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endTime"],
  })
  .refine((v) => v.mode !== "range" || v.to >= v.from, {
    message: "Ngày kết thúc phải từ ngày bắt đầu trở đi",
    path: ["to"],
  })

export type SlotLockInput = z.infer<typeof slotLockSchema>

/**
 * The three nullable columns the row actually stores, from a validated input.
 * Keeping the mapping here means the form, the action and the database agree
 * on what "một ngày" means without each one deciding for itself.
 */
export function toLockColumns(input: SlotLockInput): {
  day_of_week: number | null
  effective_from: string | null
  effective_to: string | null
} {
  switch (input.mode) {
    case "date":
      return { day_of_week: null, effective_from: input.date, effective_to: input.date }
    case "range":
      return { day_of_week: null, effective_from: input.from, effective_to: input.to }
    case "weekly":
      return { day_of_week: input.dayOfWeek, effective_from: null, effective_to: null }
  }
}

export const DAY_LABELS: Record<number, string> = {
  1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6", 6: "Thứ 7", 7: "Chủ nhật",
}
