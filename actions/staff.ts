"use server"

import { revalidatePath, refresh } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { staffSchema, updateStaffSchema } from "@/lib/validations/staff"
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
  refresh()
  return { ok: true, data: { id: userData.user.id } }
}

export async function updateStaffAction(input: unknown): Promise<ActionResult<null>> {
  await requireAdmin()
  const parsed = updateStaffSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const admin = createAdminClient()
  const { error } = await admin
    .from("profiles")
    .update({ full_name: parsed.data.fullName, role: parsed.data.role })
    .eq("id", parsed.data.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/nhan-su")
  refresh()
  return { ok: true, data: null }
}

/**
 * Deletes the auth user directly (profiles.id cascades from auth.users, so
 * its row goes with it). Unlike students/desks, no explicit history guard
 * is needed here: registrations/slot_locks/recurring_registrations.created_by
 * references auth.users(id) with the default RESTRICT behavior (no ON
 * DELETE clause in migration 0001), so Postgres itself refuses the delete
 * if this account has ever created a booking — surfaced as a plain error.
 */
export async function deleteStaffAction(profileId: string): Promise<ActionResult<null>> {
  const requester = await requireAdmin()
  if (requester.id === profileId) return { ok: false, error: "Không thể tự xoá tài khoản của chính mình" }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(profileId)
  if (error) {
    return {
      ok: false,
      error: error.message.includes("foreign key") || error.code === "23503"
        ? "Không thể xoá — tài khoản này đã tạo lịch/khoá lịch trong hệ thống"
        : error.message,
    }
  }

  revalidatePath("/noi-bo/quan-ly/nhan-su")
  refresh()
  return { ok: true, data: null }
}
