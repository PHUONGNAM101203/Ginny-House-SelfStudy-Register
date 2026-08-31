"use server"

import { revalidatePath, refresh } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { branchSchema, updateBranchSchema } from "@/lib/validations/branch"
import type { ActionResult } from "@/types"

export async function createBranchAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = branchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase.from("branches").insert(parsed.data).select("id").single()
  if (error) return { ok: false, error: error.code === "23505" ? "Mã cơ sở đã tồn tại" : error.message }

  revalidatePath("/noi-bo/quan-ly/co-so")
  refresh()
  return { ok: true, data: { id: data.id } }
}

export async function updateBranchAction(input: unknown): Promise<ActionResult<null>> {
  await requireAdmin()
  const parsed = updateBranchSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { error } = await supabase.from("branches").update({ name: parsed.data.name }).eq("id", parsed.data.id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/co-so")
  revalidatePath("/")
  refresh()
  return { ok: true, data: null }
}
