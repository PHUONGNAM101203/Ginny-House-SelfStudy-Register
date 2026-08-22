import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { StudentTable } from "@/components/admin/StudentTable"
import { RecurringRegistrationTable, type RecurringRow } from "@/components/admin/RecurringRegistrationTable"

// Postgres `time` serializes as "HH:MM:SS" over PostgREST; the UI shows "HH:MM"
// (same normalization as lib/schedule-data.ts's toHm).
function toHm(value: string): string {
  const [h, m] = value.split(":")
  return `${h}:${m}`
}

type RecurringQueryRow = {
  id: string
  student_name: string
  class_name: string | null
  day_of_week: number
  start_time: string
  end_time: string
  branches: { name: string } | null
  desks: { label: string } | null
}

export default async function StudentsPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const [{ data: students }, { data: recurring }, { data: recentRegistrations }] = await Promise.all([
    supabase.from("students").select("id, full_name, phone, created_at").order("full_name"),
    supabase
      .from("recurring_registrations")
      .select("id, student_name, class_name, day_of_week, start_time, end_time, branches(name), desks(label)")
      .eq("active", true)
      .order("student_name"),
    // Each student's most recent class, for StudentTable — a student has no
    // class_name of their own (only registrations/recurring_registrations
    // do, since it can change over time), so this is a "latest known class"
    // read, not a stored attribute. Joined/reduced in TS rather than a
    // Postgres DISTINCT ON, matching this codebase's established pattern of
    // avoiding deep PostgREST embeds and complex SQL in favor of plain
    // queries reduced in TS (see co-so/yeu-cau-doi-lich pages).
    supabase.from("registrations").select("student_id, class_name, date").not("class_name", "is", null).order("date", { ascending: false }),
  ])

  const recurringRows: RecurringRow[] = ((recurring ?? []) as unknown as RecurringQueryRow[]).map((r) => ({
    id: r.id,
    student_name: r.student_name,
    class_name: r.class_name,
    branch_name: r.branches?.name ?? "",
    desk_label: r.desks?.label ?? "",
    day_of_week: r.day_of_week,
    start_time: toHm(r.start_time),
    end_time: toHm(r.end_time),
  }))

  // First match per student wins — recentRegistrations is already ordered
  // by date descending, so that's the most recent class.
  const latestClassByStudentId = new Map<string, string>()
  for (const r of recentRegistrations ?? []) {
    if (!latestClassByStudentId.has(r.student_id) && r.class_name) latestClassByStudentId.set(r.student_id, r.class_name)
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Học sinh</h1>
        <StudentTable
          students={(students ?? []).map((s) => ({ ...s, class_name: latestClassByStudentId.get(s.id) ?? null }))}
        />
      </div>
      <div>
        <h2 className="mb-1 text-lg font-semibold">Lịch cố định đang áp dụng</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Huỷ lịch cố định sẽ dừng tự động giữ chỗ cho các tuần sau. Buổi đã đăng ký của tuần này vẫn giữ nguyên —
          huỷ riêng từng buổi trên lịch nếu cần.
        </p>
        <RecurringRegistrationTable rows={recurringRows} />
      </div>
    </div>
  )
}
