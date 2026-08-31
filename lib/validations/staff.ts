import { z } from "zod"

export const staffSchema = z.object({
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  role: z.enum(["admin", "quan_sinh"], { message: "Vai trò không hợp lệ" }),
})
export type StaffInput = z.infer<typeof staffSchema>

// Email/password are not editable here — changing an auth user's login
// credentials needs its own dedicated flow (email confirmation, password
// reset), not a plain profile update. Name and role only.
export const updateStaffSchema = z.object({
  id: z.string().uuid("Tài khoản không hợp lệ"),
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  role: z.enum(["admin", "quan_sinh"], { message: "Vai trò không hợp lệ" }),
})
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>
