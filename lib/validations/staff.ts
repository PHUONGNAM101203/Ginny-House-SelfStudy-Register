import { z } from "zod"

export const staffSchema = z.object({
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["admin", "quan_sinh"], { message: "Vai trò không hợp lệ" }),
})
export type StaffInput = z.infer<typeof staffSchema>
