import { z } from "zod"

export const staffSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["admin", "quan_sinh"]),
})
export type StaffInput = z.infer<typeof staffSchema>
