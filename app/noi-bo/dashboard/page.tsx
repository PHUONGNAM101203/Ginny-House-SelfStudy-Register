import { requireProfile } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { getMondayOfWeek, getWeekDates } from "@/lib/week"
import { parseYmd, vietnamToday } from "@/lib/vn-date"
import { findMissingRegistrations, computeFrequencyRanking } from "@/lib/dashboard"
import {
  countByDate,
  countByBranch,
  countByDesk,
  countByStartTime,
  countByKind,
  countDistinctStudents,
  totalBookedHours,
  type StatRegistration,
} from "@/lib/dashboard-stats"
import { sendPushToRole } from "@/lib/push/send"
import { broadcastNotificationsUpdate } from "@/lib/notification-realtime"
import { DailyCountChart } from "@/components/dashboard/DailyCountChart"
import { CountBarList } from "@/components/dashboard/CountBarList"
import { StatCard } from "@/components/dashboard/StatCard"
import { MissingRegistrationsList } from "@/components/dashboard/MissingRegistrationsList"
import { TrendChart } from "@/components/dashboard/TrendChart"
import { FrequencyRanking } from "@/components/dashboard/FrequencyRanking"
import { format, subWeeks } from "date-fns"
import { after } from "next/server"

// Postgres `time` columns serialize over PostgREST as "HH:MM:SS" (or with fractional
// seconds). lib/dashboard-stats.ts compares lock times against
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
  const monday = getMondayOfWeek(parseYmd(vietnamToday()))
  const weekDates = getWeekDates(monday).map((d) => format(d, "yyyy-MM-dd"))
  const eightWeeksAgo = format(subWeeks(monday, 8), "yyyy-MM-dd")

  const [
    { data: desks },
    { data: registrations },
    { data: locks },
    { data: recurring },
    { data: branches },
    { count: activeStudentCount },
    { count: pendingRequestCount },
  ] = await Promise.all([
    supabase.from("desks").select("id, label, branch_id").eq("active", true),
    // Only "active" registrations should count toward a booked slot, a satisfied
    // recurring commitment, or a student's attendance streak — a cancelled row is
    // neither. findMissingRegistrations takes plain {studentId,date}
    // shapes with no status field (they trust the caller to have already filtered),
    // so this filter has to happen here at the query, same as lib/schedule-data.ts's
    // getScheduleData does for the guest schedule grid.
    // .limit(10000) matches supabase/config.toml's raised `max_rows`: explicit and intentional
    // rather than silently truncating at PostgREST's default. TODO: replace with SQL-side
    // aggregation (a view or RPC returning pre-computed metrics) once data volume grows.
    // Cancelled rows come back too now: the dashboard reports how many huỷ
    // there were, which is a number the old "active only" query could never
    // produce. Everything that must ignore them filters on status itself.
    supabase.from("registrations").select("student_id, student_name, branch_id, desk_id, date, start_time, end_time, status, recurring_registration_id").gte("date", eightWeeksAgo).limit(10000),
    supabase.from("slot_locks").select("desk_id, day_of_week, start_time, end_time").eq("active", true),
    supabase.from("recurring_registrations").select("student_id, student_name, class_name, day_of_week, active").eq("active", true),
    supabase.from("branches").select("id, name"),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("registration_change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ])
  // Joined in TS rather than via a PostgREST embed — matches the pattern
  // already used by app/noi-bo/quan-ly/co-so, and sidesteps PostgREST's
  // embed-shape ambiguity (object vs single-element array) for a to-one
  // relation.
  const recurringStudentIds = [...new Set((recurring ?? []).map((r) => r.student_id))]
  const { data: recurringStudents } = await supabase.from("students").select("id, phone").in("id", recurringStudentIds)
  const phoneByStudentId = new Map((recurringStudents ?? []).map((s) => [s.id, s.phone]))

  const missing = findMissingRegistrations(
    (recurring ?? []).map((r) => ({
      studentId: r.student_id,
      studentName: r.student_name,
      phone: phoneByStudentId.get(r.student_id) ?? "",
      className: r.class_name,
      dayOfWeek: r.day_of_week,
      active: r.active,
    })),
    (registrations ?? []).map((r) => ({ studentId: r.student_id, date: r.date })),
    format(monday, "yyyy-MM-dd")
  )

  // Mirror each missing student into the persisted notification log, deduped
  // by student+week so revisiting the dashboard mid-week doesn't spam
  // duplicates. Unlike the original design (kept history even after a
  // student registered), the notification is now auto-removed once it's
  // resolved — a stale "chưa đăng ký" notice for someone who already booked
  // is exactly the case the "auto xoá khi hành động đã thực hiện" ask
  // described.
  const mondayStr = format(monday, "yyyy-MM-dd")
  if (missing.length > 0) {
    // Best-effort: a failed sync (e.g. a transient network blip) shouldn't
    // break the dashboard render — the notification is a convenience mirror
    // of data this panel already displays directly.
    const { data: newlyMissing } = await supabase
      .from("notifications")
      .upsert(
        missing.map((m) => ({
          type: "missing_registration_weekly" as const,
          title: "Học sinh chưa đăng ký tuần này",
          body: m.className ? `${m.studentName} · ${m.className}` : m.studentName,
          link: "/noi-bo/dashboard",
          target_role: null,
          dedupe_key: `missing:${m.studentId}:${mondayStr}`,
        })),
        { onConflict: "dedupe_key", ignoreDuplicates: true }
      )
      .select("id")

    // ignoreDuplicates -> ON CONFLICT DO NOTHING, so a row that already
    // existed (already pushed on an earlier dashboard visit this week) never
    // comes back through .select() here — this only fires for genuinely new
    // misses, one summary push per run rather than one per student.
    if (newlyMissing && newlyMissing.length > 0) {
      after(async () => {
        await sendPushToRole(null, {
          title: "Học sinh chưa đăng ký tuần này",
          body: `${newlyMissing.length} học sinh chưa đăng ký tuần này`,
          link: "/noi-bo/dashboard",
        })
        await broadcastNotificationsUpdate()
      })
    }
  }

  // A student who WAS missing earlier this week but has since registered no
  // longer needs their notice. Fetch this week's still-pending rows and
  // delete-by-id (rather than building a raw SQL `NOT IN (...)` filter
  // string) for whichever ones aren't in the current `missing` set anymore.
  const stillMissingKeys = new Set(missing.map((m) => `missing:${m.studentId}:${mondayStr}`))
  const { data: weekNotifications } = await supabase
    .from("notifications")
    .select("id, dedupe_key")
    .like("dedupe_key", `missing:%:${mondayStr}`)
  const resolvedIds = (weekNotifications ?? []).filter((n) => !stillMissingKeys.has(n.dedupe_key!)).map((n) => n.id)
  if (resolvedIds.length > 0) {
    await supabase.from("notifications").delete().in("id", resolvedIds)
    after(() => broadcastNotificationsUpdate())
  }

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

  // ---- absolute-number statistics (lib/dashboard-stats.ts) --------------
  const rows: StatRegistration[] = (registrations ?? []).map((r) => ({
    studentId: r.student_id,
    studentName: r.student_name,
    branchId: r.branch_id,
    deskId: r.desk_id,
    date: r.date,
    startTime: toHm(r.start_time),
    endTime: toHm(r.end_time),
    status: r.status,
    recurringRegistrationId: r.recurring_registration_id,
  }))

  const weekSet = new Set(weekDates)
  const thisWeek = rows.filter((r) => weekSet.has(r.date))
  const todayStr = vietnamToday()
  const branchNames = new Map((branches ?? []).map((b) => [b.id, b.name]))
  const deskLabels = new Map((desks ?? []).map((d) => [d.id, d.label]))

  const kinds = countByKind(thisWeek)
  const perDay = countByDate(thisWeek, weekDates)
  const activeThisWeek = thisWeek.filter((r) => r.status === "active")
  const todayCount = activeThisWeek.filter((r) => r.date === todayStr).length
  const upcoming = activeThisWeek.filter((r) => r.date >= todayStr).length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard thống kê</h1>
        <p className="text-sm text-muted-foreground">
          Tuần {toDayMonth(weekDates[0])} – {toDayMonth(weekDates[6])}
        </p>
      </div>

      {/* Headline counts. Every figure is a real number of buổi / người —
          nothing here is a rate, which is the whole point of the redesign. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Lượt đăng ký tuần này" value={activeThisWeek.length} tone="primary" />
        <StatCard label="Hôm nay" value={todayCount} hint={toDayMonth(todayStr)} />
        <StatCard label="Sắp tới trong tuần" value={upcoming} />
        <StatCard label="Số giờ đã đặt" value={totalBookedHours(thisWeek)} hint="giờ, tuần này" />
        <StatCard label="Học sinh có lịch tuần này" value={countDistinctStudents(thisWeek)} />
        <StatCard label="Lượt huỷ tuần này" value={kinds.cancelled} tone="muted" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Lịch bình thường" value={kinds.normal} />
        <StatCard label="Lịch cố định" value={kinds.recurring} tone="gold" />
        <StatCard label="Chỗ cố định còn trống" value={kinds.vacant} tone="gold" />
        <StatCard label="Yêu cầu chờ duyệt" value={pendingRequestCount ?? 0} tone={pendingRequestCount ? "primary" : "muted"} />
        <StatCard label="Học sinh đang hoạt động" value={activeStudentCount ?? 0} hint="toàn hệ thống" />
        <StatCard label="Chỗ ngồi đang mở" value={desks?.length ?? 0} hint={`${locks?.length ?? 0} khoá lịch`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Lượt đăng ký từng ngày (tuần này)</h2>
          <DailyCountChart rows={perDay} />
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Xu hướng đăng ký theo tuần (8 tuần gần nhất)</h2>
          <TrendChart points={trendPoints} />
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Theo cơ sở (tuần này)</h2>
          <CountBarList rows={countByBranch(thisWeek, branchNames)} emptyMessage="Tuần này chưa có lượt đăng ký nào." />
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Khung giờ đông nhất (tuần này)</h2>
          <CountBarList rows={countByStartTime(thisWeek)} emptyMessage="Tuần này chưa có lượt đăng ký nào." />
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Chỗ ngồi được dùng nhiều nhất (tuần này)</h2>
          <CountBarList rows={countByDesk(thisWeek, deskLabels)} emptyMessage="Tuần này chưa có lượt đăng ký nào." />
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="mb-3 font-medium">Xếp hạng tần suất học (4 tuần gần nhất)</h2>
          <FrequencyRanking rows={ranking} />
        </section>

        <section className="rounded-lg border p-4 lg:col-span-2">
          <h2 className="mb-2 font-medium">Học sinh chưa đăng ký tuần này</h2>
          <MissingRegistrationsList students={missing} />
        </section>
      </div>
    </div>
  )
}
