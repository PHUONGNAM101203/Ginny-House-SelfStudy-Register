import { z } from "zod"

export const deskSchema = z.object({
  branchId: z.string().uuid(),
  label: z.string().trim().min(1).max(50),
  active: z.boolean().default(true),
})
export type DeskInput = z.infer<typeof deskSchema>
