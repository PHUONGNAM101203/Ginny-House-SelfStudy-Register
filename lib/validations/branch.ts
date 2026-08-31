import { z } from "zod"

export const branchSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Mã quá ngắn")
    .max(50, "Mã quá dài")
    .regex(/^[a-z0-9-]+$/, "Chỉ chữ thường, số và dấu gạch ngang"),
  name: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
})
export type BranchInput = z.infer<typeof branchSchema>

// Code is intentionally not editable — sortBranchesDefaultFirst and several
// other call sites match on it (e.g. code === "hoang-gia"), so renaming it
// would silently break those, not just this row.
export const updateBranchSchema = z.object({
  id: z.string().uuid("Cơ sở không hợp lệ"),
  name: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
})
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>
