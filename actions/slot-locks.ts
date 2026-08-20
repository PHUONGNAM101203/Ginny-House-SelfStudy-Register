"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { slotLockSchema } from "@/lib/validations/slot-lock"
import type { ActionResult } from "@/types"

export async function createSlotLockAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const profile = await requireAdmin()
  const parsed = slotLockSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from("slot_locks")
    .insert({
      branch_id: parsed.data.branchId,
      desk_id: parsed.data.deskId,
      day_of_week: parsed.data.dayOfWeek,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      reason: parsed.data.reason,
      created_by: profile.id,
    })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/khoa-lich")
  revalidatePath("/")
  return { ok: true, data: { id: data.id } }
}

export async function deactivateSlotLockAction(id: string): Promise<ActionResult<null>> {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from("slot_locks").update({ active: false }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/khoa-lich")
  revalidatePath("/")
  return { ok: true, data: null }
}
