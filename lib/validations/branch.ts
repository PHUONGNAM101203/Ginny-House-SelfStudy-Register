import { z } from "zod"

export const branchSchema = z.object({
  code: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/, "Chỉ chữ thường, số và dấu gạch ngang"),
  name: z.string().trim().min(2).max(100),
})
export type BranchInput = z.infer<typeof branchSchema>
