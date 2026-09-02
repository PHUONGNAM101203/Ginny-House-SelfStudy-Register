"use server"

import { revalidatePath, refresh } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { createStudentSchema, updateStudentSchema, importStudentsSchema, createRecurringScheduleSchema, searchStudentsSchema } from "@/lib/validations/student"
import type { ActionResult } from "@/types"

export type StudentSearchHit = {
  id: string
  fullName: string
  className: string | null
  /**
   * Null for anonymous guests — search_students (migration 0021) only
   * returns a phone to staff, so the guest-facing autocomplete can fill in
   * lớp without turning the booking form into a phone-number directory.
   */
  phone: string | null
}

/**
 * Deliberately NOT admin-guarded: the guest booking form uses this too, and
 * the RPC itself decides what each caller is allowed to see.
 */
export async function searchStudentsAction(input: unknown): Promise<ActionResult<StudentSearchHit[]>> {
  const parsed = searchStudentsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Từ khoá không hợp lệ" }

  // The public client for guests, the authenticated one for staff — the RPC
  // reads is_staff() off the session to decide whether to include phone, so
  // sending a staff request through the anon client would silently downgrade
  // them to guest results.
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("search_students", { p_query: parsed.data.query })
  if (error) return { ok: false, error: error.message }

  type Row = { id: string; full_name: string; class_name: string | null; phone: string | null }
  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      fullName: r.full_name,
      className: r.class_name,
      phone: r.phone,
    })),
  }
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

export async function updateStudentAction(input: unknown): Promise<ActionResult<null>> {
  await requireAdmin()
  const parsed = updateStudentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }

  const supabase = await createServerClient()
  const { error } = await supabase
    .from("students")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq("id", parsed.data.id)
  if (error) return { ok: false, error: error.code === "23505" ? "Số điện thoại đã được dùng bởi học sinh khác" : error.message }

  revalidatePath("/noi-bo/quan-ly/hoc-sinh")
  refresh()
  return { ok: true, data: null }
}

/**
 * `students.id` cascades to registrations/recurring_registrations (see
 * migration 0001) — a hard delete on a student with any booking history
 * would silently erase that history. Blocked here the same way
 * deleteDeskAction guards desks.
 */
/**
 * Deleting a student takes their bookings with them: registrations and
 * recurring_registrations both reference students ON DELETE CASCADE.
 *
 * This used to refuse outright whenever any booking row existed, which in
 * practice meant it could almost never be used — cancelling a booking only
 * sets status = 'cancelled', the row stays, so an admin who had cleared
 * every schedule off the calendar still got "không thể xoá để giữ lịch sử".
 * Gin Anh wants the delete to actually work. So the guard is now informed
 * consent instead of a block: the confirm dialog states exactly how many
 * bookings will go, and the caller decides.
 */
export async function deleteStudentAction(studentId: string): Promise<ActionResult<null>> {
  await requireAdmin()
  const supabase = await createServerClient()

  const { error } = await supabase.from("students").delete().eq("id", studentId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/hoc-sinh")
  revalidatePath("/noi-bo/lich")
  refresh()
  return { ok: true, data: null }
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
