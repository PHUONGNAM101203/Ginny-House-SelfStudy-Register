import { z } from "zod"

export const deskSchema = z.object({
  branchId: z.string().uuid("Cơ sở không hợp lệ"),
  label: z.string().trim().min(1, "Vui lòng nhập tên chỗ").max(50, "Tên chỗ quá dài"),
  active: z.boolean().default(true),
})
export type DeskInput = z.infer<typeof deskSchema>
