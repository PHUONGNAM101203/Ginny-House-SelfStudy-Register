"use server"

import { revalidatePath, refresh } from "next/cache"
import { addDays } from "date-fns"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { slotLockSchema, toLockColumns } from "@/lib/validations/slot-lock"
import { getMondayOfWeek } from "@/lib/week"
import { parseYmd, toYmd, vietnamToday } from "@/lib/vn-date"
import type { ActionResult } from "@/types"

function revalidateLockPages() {
  revalidatePath("/noi-bo/quan-ly/khoa-lich")
  revalidatePath("/noi-bo/lich")
  revalidatePath("/")
  // onClick-invoked (not <form action>) — revalidatePath alone won't push a
  // refresh to this page; see actions/students.ts's createStudentAction for
  // the full explanation of this Next.js version's behavior.
  refresh()
}

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
      // One row, four shapes — see lib/validations/slot-lock.ts's
      // toLockColumns and migration 0041.
      ...toLockColumns(parsed.data),
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      reason: parsed.data.reason,
      created_by: profile.id,
    })
    .select("id")
    .single()
  if (error) return { ok: false, error: error.message }

  revalidateLockPages()
  return { ok: true, data: { id: data.id } }
}

/**
 * The button this whole feature exists for.
 *
 * "Mở lịch cho tuần sau" used to mean deactivating the lock, which opened
 * *this* week along with it — including the buổi thi thử already under way.
 * Setting an end date on the current week instead keeps this week locked and
 * lets the lock lapse on its own from Monday.
 */
export async function endSlotLockAfterThisWeekAction(id: string): Promise<ActionResult<{ effectiveTo: string }>> {
  await requireAdmin()
  const sunday = toYmd(addDays(getMondayOfWeek(parseYmd(vietnamToday())), 6))

  const supabase = await createServerClient()
  const { error } = await supabase.from("slot_locks").update({ effective_to: sunday }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidateLockPages()
  return { ok: true, data: { effectiveTo: sunday } }
}

/**
 * Removes the lock outright, this week included. Kept, because it is
 * occasionally what someone means — but the button now says so, since
 * reaching for it when "từ tuần sau" was meant is the original incident.
 */
export async function deactivateSlotLockAction(id: string): Promise<ActionResult<null>> {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from("slot_locks").update({ active: false }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidateLockPages()
  return { ok: true, data: null }
}
