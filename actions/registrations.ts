"use server"

import { revalidatePath } from "next/cache"
import { createPublicClient } from "@/lib/supabase/public"
import { createRegistrationSchema, cancelRegistrationSchema } from "@/lib/validations/registration"
import type { ActionResult } from "@/types"

export async function createRegistrationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("create_registration", {
    p_desk_id: parsed.data.deskId,
    p_date: parsed.data.date,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_is_recurring: parsed.data.isRecurring,
    p_admin_created: false,
  })

  if (error) {
    if (error.code === "23P01" || error.code === "40P01") {
      // 23P01: the GiST exclusion constraint cleanly rejects the losing insert.
      // 40P01: under real concurrency, two overlapping inserts can instead
      // deadlock each other while the exclusion check holds index-level
      // locks; Postgres kills one as the deadlock victim. Same user-facing
      // meaning either way — someone else just took this slot.
      return { ok: false, error: "Khung giờ này vừa có người đặt, vui lòng chọn khung khác" }
    }
    if (error.message.includes("Slot is locked")) {
      return { ok: false, error: "Khung giờ này đã bị khoá, không có phòng" }
    }
    return { ok: false, error: "Có lỗi xảy ra, vui lòng thử lại" }
  }

  revalidatePath("/")
  return { ok: true, data: { id: data.id } }
}

export async function cancelRegistrationAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = cancelRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = createPublicClient()
  const { error } = await supabase.rpc("cancel_registration", {
    p_registration_id: parsed.data.registrationId,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
  })

  if (error) {
    return { ok: false, error: "Tên hoặc số điện thoại không khớp" }
  }

  revalidatePath("/")
  return { ok: true, data: null }
}
