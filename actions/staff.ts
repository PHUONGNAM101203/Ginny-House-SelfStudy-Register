"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { staffSchema } from "@/lib/validations/staff"
import type { ActionResult } from "@/types"

export async function createStaffAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = staffSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const admin = createAdminClient()
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  })
  if (userError || !userData.user) return { ok: false, error: userError?.message ?? "Không tạo được tài khoản" }

  const { error: profileError } = await admin
    .from("profiles")
    .insert({ id: userData.user.id, full_name: parsed.data.fullName, role: parsed.data.role })
  if (profileError) return { ok: false, error: profileError.message }

  revalidatePath("/noi-bo/quan-ly/nhan-su")
  return { ok: true, data: { id: userData.user.id } }
}
