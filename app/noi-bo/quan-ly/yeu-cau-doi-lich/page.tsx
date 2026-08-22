import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { ChangeRequestTable, type ChangeRequestRow } from "@/components/admin/ChangeRequestTable"

// Postgres `time` columns serialize over PostgREST as "HH:MM:SS" — same
// normalization as lib/schedule-data.ts's toHm, duplicated locally rather
// than shared (matches this codebase's existing precedent: dashboard/page.tsx
// keeps its own copy too).
function toHm(value: string): string {
  const [h, m] = value.split(":")
  return `${h}:${m}`
}

export default async function ChangeRequestsPage() {
  await requireAdmin()
  const supabase = await createServerClient()

  const { data: requests } = await supabase
    .from("registration_change_requests")
    .select(
      "id, registration_id, kind, requested_by_name, requested_by_phone, reason, new_desk_id, new_date, new_start_time, new_end_time, created_at"
    )
    .eq("status", "pending")
    .order("created_at")

  const registrationIds = [...new Set((requests ?? []).map((r) => r.registration_id))]
  const { data: registrations } =
    registrationIds.length > 0
      ? await supabase
          .from("registrations")
          .select("id, desk_id, date, start_time, end_time, student_name, class_name")
          .in("id", registrationIds)
      : { data: [] }

  const deskIds = [
    ...new Set([
      ...(registrations ?? []).map((r) => r.desk_id),
      ...(requests ?? []).map((r) => r.new_desk_id).filter((id): id is string => id !== null),
    ]),
  ]
  const { data: desks } = deskIds.length > 0 ? await supabase.from("desks").select("id, label").in("id", deskIds) : { data: [] }

  const registrationById = new Map((registrations ?? []).map((r) => [r.id, r]))
  const deskLabelById = new Map((desks ?? []).map((d) => [d.id, d.label]))

  const rows: ChangeRequestRow[] = (requests ?? []).map((r) => {
    const reg = registrationById.get(r.registration_id)
    return {
      id: r.id,
      kind: r.kind,
      requestedByName: r.requested_by_name,
      requestedByPhone: r.requested_by_phone,
      reason: r.reason,
      deskLabel: reg ? (deskLabelById.get(reg.desk_id) ?? "?") : "?",
      date: reg?.date ?? "",
      startTime: reg ? toHm(reg.start_time) : "",
      endTime: reg ? toHm(reg.end_time) : "",
      studentName: reg?.student_name ?? "",
      className: reg?.class_name ?? null,
      newDeskLabel: r.new_desk_id ? (deskLabelById.get(r.new_desk_id) ?? "?") : null,
      newDate: r.new_date,
      newStartTime: r.new_start_time ? toHm(r.new_start_time) : null,
      newEndTime: r.new_end_time ? toHm(r.new_end_time) : null,
    }
  })

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Yêu cầu huỷ / đổi lịch</h1>
      <ChangeRequestTable rows={rows} />
    </div>
  )
}
