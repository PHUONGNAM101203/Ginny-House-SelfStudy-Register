import { addDays } from "date-fns"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { SlotLockForm } from "@/components/admin/SlotLockForm"
import { SlotLockTable, type LockConflict } from "@/components/admin/SlotLockTable"
import { sortDesks } from "@/lib/desks"
import { sortBranchesDefaultFirst } from "@/lib/branches"
import { lockAppliesOn } from "@/lib/slot-locks"
import { parseYmd, toYmd, vietnamToday } from "@/lib/vn-date"

/**
 * How far ahead to look for bookings a lock has caught. Same horizon as
 * lib/schedule-data.ts's MAX_MATERIALIZE_WEEKS_AHEAD: beyond it no recurring
 * booking has been created yet, so there is nothing there to find.
 */
const CONFLICT_WEEKS_AHEAD = 8

export default async function SlotLockPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const today = vietnamToday()
  const horizon = toYmd(addDays(parseYmd(today), CONFLICT_WEEKS_AHEAD * 7))

  const [{ data: branches }, { data: desks }, { data: locks }, { data: registrations }] = await Promise.all([
    supabase.from("branches").select("id, code, name").order("name"),
    // Sorted in TS below, not by SQL — see lib/desks.ts ("Chỗ 10" vs "Chỗ 2").
    supabase.from("desks").select("id, branch_id, label"),
    supabase
      .from("slot_locks")
      .select(
        "id, branch_id, desk_id, day_of_week, start_time, end_time, effective_from, effective_to, reason, branches(name), desks(label)"
      )
      .eq("active", true),
    // Bookings a lock may have caught. Locking a day deliberately does not
    // touch them — it only stops new ones — so they are listed instead, with
    // enough detail to ring the student, and cancelled one at a time if that
    // is what's wanted.
    supabase
      .from("registrations")
      .select("id, branch_id, desk_id, date, start_time, end_time, student_id, student_name, class_name")
      .eq("status", "active")
      .gte("date", today)
      .lte("date", horizon)
      .limit(10000),
  ])

  type LockRow = {
    id: string
    branch_id: string
    desk_id: string | null
    day_of_week: number | null
    start_time: string
    end_time: string
    effective_from: string | null
    effective_to: string | null
    reason: string | null
    branches: { name: string } | null
    desks: { label: string } | null
  }

  const lockRows = (locks ?? []) as unknown as LockRow[]
  const deskLabelById = new Map((desks ?? []).map((d) => [d.id, d.label]))

  // Phone numbers so whoever locks the day can actually let the students
  // know. Staff-only page, authenticated client.
  const studentIds = [...new Set((registrations ?? []).map((r) => r.student_id))].filter(
    (id): id is string => id !== null
  )
  let phoneByStudentId = new Map<string, string>()
  if (studentIds.length > 0) {
    const { data: students } = await supabase.from("students").select("id, phone").in("id", studentIds)
    phoneByStudentId = new Map((students ?? []).map((s) => [s.id, s.phone]))
  }

  /** "HH:MM:SS" from Postgres → "HH:MM", the form everything else compares. */
  const hm = (t: string) => t.slice(0, 5)

  const conflictsByLock: Record<string, LockConflict[]> = {}
  for (const lock of lockRows) {
    conflictsByLock[lock.id] = (registrations ?? [])
      .filter(
        (r) =>
          r.branch_id === lock.branch_id &&
          // desk_id null on the lock = cả cơ sở, so it catches every desk.
          (lock.desk_id === null || lock.desk_id === r.desk_id) &&
          lockAppliesOn(
            { dayOfWeek: lock.day_of_week, effectiveFrom: lock.effective_from, effectiveTo: lock.effective_to },
            r.date
          ) &&
          hm(r.start_time) < hm(lock.end_time) &&
          hm(r.end_time) > hm(lock.start_time)
      )
      .map((r) => ({
        id: r.id,
        date: r.date,
        startTime: hm(r.start_time),
        endTime: hm(r.end_time),
        deskLabel: deskLabelById.get(r.desk_id) ?? "",
        studentName: r.student_name,
        className: r.class_name,
        phone: r.student_id ? (phoneByStudentId.get(r.student_id) ?? null) : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
  }

  const rows = lockRows.map((l) => ({
    id: l.id,
    branch_id: l.branch_id,
    branch_name: l.branches?.name ?? "",
    desk_label: l.desks?.label ?? null,
    day_of_week: l.day_of_week,
    start_time: l.start_time,
    end_time: l.end_time,
    effective_from: l.effective_from,
    effective_to: l.effective_to,
    reason: l.reason,
  }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Khoá / mở lịch</h1>
      {/* SlotLockForm already narrows this list to the selected branch, so a
          plain desk-number sort is enough here. */}
      <SlotLockForm branches={sortBranchesDefaultFirst(branches ?? [])} desks={sortDesks(desks ?? [])} />
      <SlotLockTable
        locks={rows}
        branches={sortBranchesDefaultFirst(branches ?? [])}
        conflictsByLock={conflictsByLock}
      />
    </div>
  )
}
