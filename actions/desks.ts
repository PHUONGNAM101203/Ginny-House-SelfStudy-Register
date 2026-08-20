"use server"

import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { deskSchema } from "@/lib/validations/desk"
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
  return { ok: true, data: { id: data.id } }
}

export async function toggleDeskActiveAction(deskId: string, active: boolean): Promise<ActionResult<null>> {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from("desks").update({ active }).eq("id", deskId)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/noi-bo/quan-ly/co-so")
  return { ok: true, data: null }
}
