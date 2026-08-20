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
  day_of_week: number
  start_time: string
  end_time: string
  branches: { name: string } | null
  desks: { label: string } | null
}

export default async function StudentsPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const [{ data: students }, { data: recurring }] = await Promise.all([
    supabase.from("students").select("id, full_name, phone, created_at").order("full_name"),
    supabase
      .from("recurring_registrations")
      .select("id, student_name, day_of_week, start_time, end_time, branches(name), desks(label)")
      .eq("active", true)
      .order("student_name"),
  ])

  const recurringRows: RecurringRow[] = ((recurring ?? []) as unknown as RecurringQueryRow[]).map((r) => ({
    id: r.id,
    student_name: r.student_name,
    branch_name: r.branches?.name ?? "",
    desk_label: r.desks?.label ?? "",
    day_of_week: r.day_of_week,
    start_time: toHm(r.start_time),
    end_time: toHm(r.end_time),
  }))

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-4 text-xl font-semibold">Học sinh</h1>
        <StudentTable students={students ?? []} />
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
