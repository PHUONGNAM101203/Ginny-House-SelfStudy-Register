import { z } from "zod"
import { normalizeClassName } from "@/lib/class-name"
import { phoneRegex } from "@/lib/validations/registration"

export const createStudentSchema = z.object({
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  phone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
})
export type CreateStudentInput = z.infer<typeof createStudentSchema>

export const updateStudentSchema = z.object({
  id: z.string().uuid("Học sinh không hợp lệ"),
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  phone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  // Blank clears it — a student between classes should be able to have none.
  className: z.string().trim().max(50, "Tên lớp quá dài").optional(),
})
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>

const larkRowSchema = z.object({
  fullName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
  phone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  larkRecordId: z.string().trim().max(100).optional(),
})

export const importStudentsSchema = z.object({
  rows: z.array(larkRowSchema).min(1, "File không có dòng dữ liệu nào hợp lệ").max(2000, "Tối đa 2000 dòng mỗi lần nhập"),
})
export type ImportStudentsInput = z.infer<typeof importStudentsSchema>

export const createRecurringScheduleSchema = z
  .object({
    fullName: z.string().trim().min(2, "Tên quá ngắn").max(100, "Tên quá dài"),
    phone: z.string().regex(phoneRegex, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
    branchId: z.string().uuid("Cơ sở không hợp lệ"),
    deskId: z.string().uuid("Chỗ không hợp lệ"),
    dayOfWeek: z.number().int().min(1, "Thứ không hợp lệ").max(7, "Thứ không hợp lệ"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ bắt đầu không hợp lệ"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Giờ kết thúc không hợp lệ"),
    // Required, like the booking form: a lịch cố định with no lớp is the
    // record nobody can act on later ("phải đầy đủ cả 3 trường").
    className: z.string().trim().min(1, "Vui lòng nhập tên lớp").max(100, "Tên lớp quá dài").transform(normalizeClassName),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ").optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày không hợp lệ").optional(),
  })
  .refine((v) => v.startTime < v.endTime, { message: "Giờ kết thúc phải sau giờ bắt đầu", path: ["endTime"] })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "Ngày kết thúc phải sau ngày bắt đầu",
    path: ["endDate"],
  })
export type CreateRecurringScheduleInput = z.infer<typeof createRecurringScheduleSchema>

export const searchStudentsSchema = z.object({
  query: z.string().trim().min(2, "Nhập ít nhất 2 ký tự"),
})
