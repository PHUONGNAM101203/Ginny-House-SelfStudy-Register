"use server"

import { revalidatePath, refresh } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { deskSchema, updateDeskSchema } from "@/lib/validations/desk"
import type { ActionResult } from "@/types"

export async function createDeskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = deskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("desks")
    .insert({ branch_id: parsed.data.branchId, label: parsed.data.label, active: parsed.data.active })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.code === "23505" ? "Tên chỗ đã tồn tại trong cơ sở này" : error.message }

  revalidatePath("/noi-bo/quan-ly/co-so")
  refresh()
  return { ok: true, data: { id: data.id } }
}

export async function updateDeskAction(input: unknown): Promise<ActionResult<null>> {
  await requireAdmin()
  const parsed = updateDeskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { error } = await supabase.from("desks").update({ label: parsed.data.label }).eq("id", parsed.data.id)
  if (error) return { ok: false, error: error.code === "23505" ? "Tên chỗ đã tồn tại trong cơ sở này" : error.message }

  revalidatePath("/noi-bo/quan-ly/co-so")
  revalidatePath("/")
  refresh()
  return { ok: true, data: null }
}

export async function toggleDeskActiveAction(deskId: string, active: boolean): Promise<ActionResult<null>> {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from("desks").update({ active }).eq("id", deskId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/noi-bo/quan-ly/co-so")
  refresh()
  return { ok: true, data: null }
}

/**
 * `desks.id` cascades to registrations/recurring_registrations/slot_locks
 * (see migration 0001) — a hard delete on a desk with any booking history
 * would silently erase that history. Blocked here rather than at the
 * schema level so the error message can explain the "deactivate instead"
 * alternative that already exists (toggleDeskActiveAction).
 */
export async function deleteDeskAction(deskId: string): Promise<ActionResult<null>> {
  await requireAdmin()
  const supabase = await createServerClient()

  const { count } = await supabase.from("registrations").select("id", { count: "exact", head: true }).eq("desk_id", deskId)
  if (count && count > 0) {
    return { ok: false, error: "Chỗ này đã có lịch sử đăng ký — hãy tắt chỗ thay vì xoá để giữ lịch sử" }
  }

  const { error } = await supabase.from("desks").delete().eq("id", deskId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/co-so")
  revalidatePath("/")
  refresh()
  return { ok: true, data: null }
}
