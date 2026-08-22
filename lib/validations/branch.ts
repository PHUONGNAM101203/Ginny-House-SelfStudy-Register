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
