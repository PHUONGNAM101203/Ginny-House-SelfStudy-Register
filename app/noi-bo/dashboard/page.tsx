import { requireProfile } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { getMondayOfWeek, getWeekDates } from "@/lib/week"
import { computeOccupancy, findMissingRegistrations, computeFrequencyRanking } from "@/lib/dashboard"
import { OccupancyChart } from "@/components/dashboard/OccupancyChart"
import { MissingRegistrationsList } from "@/components/dashboard/MissingRegistrationsList"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { FrequencyRanking } from "@/components/dashboard/FrequencyRanking"
import { format, subWeeks } from "date-fns"

// Postgres `time` columns serialize over PostgREST as "HH:MM:SS" (or with fractional
// seconds). lib/dashboard.ts's computeOccupancy compares lock times against
// lib/time-slots.ts's plain "HH:MM" slot boundaries with `<`/`>`, so an un-normalized
// "08:00:00" is lexicographically *greater than* "08:00" even though they're the same
// instant — that flips the overlap check exactly at slot boundaries. Normalize here,
// same as lib/schedule-data.ts's toHm() does for the guest schedule grid.
function toHm(value: string): string {
  const [h, m] = value.split(":")
  return `${h}:${m}`
}

// Bucketing registrations into ISO weeks for the trend chart needs a date-string ->
// Monday-date-string transform. `new Date(dateOnlyString)` parses as UTC midnight, but
// date-fns' startOfWeek/format then read it back out through *local* getters — in a
// negative-UTC-offset timezone that silently rolls the date back a day (the same class
// of bug fixed in Task 4 and Task 16). Do the arithmetic in UTC space only, matching
// lib/dashboard.ts's isoDayOfWeek/addDaysToDateStr helpers, and never hand the result to
// a local-time-reading function.
function isoDayOfWeek(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00Z`)
  return ((date.getUTCDay() + 6) % 7) + 1
}

function mondayOfDateStr(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - (isoDayOfWeek(dateStr) - 1))
  return date.toISOString().slice(0, 10)
}

// "yyyy-MM-dd" -> "dd/MM" by string rearrangement, avoiding a Date round-trip entirely.
function toDayMonth(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return `${d}/${m}`
}

export default async function DashboardPage() {
  await requireProfile()
  const supabase = await createServerClient()
  const monday = getMondayOfWeek(new Date())
  const weekDates = getWeekDates(monday).map((d) => format(d, "yyyy-MM-dd"))
  const eightWeeksAgo = format(subWeeks(monday, 8), "yyyy-MM-dd")

  const [{ data: desks }, { data: registrations }, { data: locks }, { data: recurring }] = await Promise.all([
    supabase.from("desks").select("id, label").eq("active", true),
    // Only "active" registrations should count toward a booked slot, a satisfied
    // recurring commitment, or a student's attendance streak — a cancelled row is
    // neither. computeOccupancy/findMissingRegistrations take plain {studentId,date}
    // shapes with no status field (they trust the caller to have already filtered),
    // so this filter has to happen here at the query, same as lib/schedule-data.ts's
    // getScheduleData does for the guest schedule grid.
    // .limit(10000) matches supabase/config.toml's raised `max_rows`: explicit and intentional
    // rather than silently truncating at PostgREST's default. TODO: replace with SQL-side
    // aggregation (a view or RPC returning pre-computed metrics) once data volume grows.
    supabase.from("registrations").select("student_id, student_name, desk_id, date, start_time, end_time, status").eq("status", "active").gte("date", eightWeeksAgo).limit(10000),
    supabase.from("slot_locks").select("desk_id, day_of_week, start_time, end_time").eq("active", true),
    supabase.from("recurring_registrations").select("student_id, student_name, day_of_week, active").eq("active", true),
  ])

  const occupancy = computeOccupancy(
    desks ?? [],
    (registrations ?? []).map((r) => ({ deskId: r.desk_id, date: r.date, startTime: toHm(r.start_time), endTime: toHm(r.end_time) })),
    (locks ?? []).map((l) => ({ deskId: l.desk_id, dayOfWeek: l.day_of_week, startTime: toHm(l.start_time), endTime: toHm(l.end_time) })),
    weekDates
  )

  const missing = findMissingRegistrations(
    (recurring ?? []).map((r) => ({ studentId: r.student_id, studentName: r.student_name, dayOfWeek: r.day_of_week, active: r.active })),
    (registrations ?? []).map((r) => ({ studentId: r.student_id, date: r.date })),
    format(monday, "yyyy-MM-dd")
  )

  const ranking = computeFrequencyRanking(
    (registrations ?? []).map((r) => ({ studentId: r.student_id, studentName: r.student_name, date: r.date, status: r.status })),
    format(subWeeks(monday, 4), "yyyy-MM-dd")
  )

  const trendByWeek = new Map<string, number>()
  for (const r of registrations ?? []) {
    if (r.status !== "active") continue
    const weekKey = mondayOfDateStr(r.date)
    trendByWeek.set(weekKey, (trendByWeek.get(weekKey) ?? 0) + 1)
  }
  const trendPoints = [...trendByWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, count]) => ({ period: toDayMonth(period), count }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard thống kê</h1>
      {/* 2 columns on wide viewports so the 4 sections read as a balanced
          grid instead of one long narrow column — paired thematically
          (this-week stats on the left, multi-week trends on the right). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Tỷ lệ lấp đầy tuần này</h2>
          <OccupancyChart rows={occupancy} />
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Xu hướng đăng ký theo tuần (8 tuần gần nhất)</h2>
          <TrendChart points={trendPoints} />
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Học sinh chưa đăng ký tuần này</h2>
          <MissingRegistrationsList students={missing} />
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Xếp hạng tần suất học (4 tuần gần nhất)</h2>
          <FrequencyRanking rows={ranking} />
        </section>
      </div>
    </div>
  )
}
