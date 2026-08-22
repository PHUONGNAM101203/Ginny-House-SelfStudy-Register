"use server"

import { revalidatePath, refresh } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { createStudentSchema, importStudentsSchema, createRecurringScheduleSchema } from "@/lib/validations/student"
import type { ActionResult } from "@/types"

export async function getStudentHistoryAction(studentId: string) {
  await requireAdmin()
  const supabase = await createServerClient()
  const { data } = await supabase
    .from("registrations")
    .select("date, start_time, end_time, status, source")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
  return data ?? []
}

export async function createStudentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = createStudentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("create_student_admin", {
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/hoc-sinh")
  // revalidatePath alone invalidates the cache but doesn't push a refresh to
  // this action's caller — CreateStudentDialog invokes it from onClick, not
  // a <form action>, so without this the new row is invisible until a full
  // page reload (see node_modules/next/dist/docs/.../07-mutating-data.md's
  // "Refresh data" vs "Revalidate data" split, added in this Next version).
  refresh()
  return { ok: true, data: { id: data.id } }
}

/** Batch upsert parsed from a Lark Base CSV export — same shape scripts/import-lark.ts's CLI reads. */
export async function importStudentsFromLarkAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  await requireAdmin()
  const parsed = importStudentsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("import_students_admin", {
    p_rows: parsed.data.rows.map((r) => ({ full_name: r.fullName, phone: r.phone, lark_record_id: r.larkRecordId ?? null })),
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/hoc-sinh")
  refresh()
  return { ok: true, data: { count: data as number } }
}

/**
 * Creates only the recurring rule directly (no accompanying one-off booking
 * for "today") — distinct from createRegistrationAction's p_is_recurring
 * path in actions/registrations.ts, which always books today's slot too.
 */
export async function createRecurringScheduleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = createRecurringScheduleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("create_recurring_registration_admin", {
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_branch_id: parsed.data.branchId,
    p_desk_id: parsed.data.deskId,
    p_day_of_week: parsed.data.dayOfWeek,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
    p_class_name: parsed.data.className ?? null,
    p_start_date: parsed.data.startDate ?? null,
    p_end_date: parsed.data.endDate ?? null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/hoc-sinh")
  revalidatePath("/")
  refresh()
  return { ok: true, data: { id: data.id } }
}
