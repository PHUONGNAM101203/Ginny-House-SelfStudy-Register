import { requireProfile } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { getBranches, getScheduleData, materializeWeek } from "@/lib/schedule-data"
import { resolveScheduleDates } from "@/lib/schedule-params"
import { resolveActiveBranchId } from "@/lib/branches"
import { getWeekDates } from "@/lib/week"
import { toYmd } from "@/lib/vn-date"
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar"
import { InternalScheduleGridClient } from "@/components/schedule/InternalScheduleGridClient"
import { WeekOverview } from "@/components/schedule/WeekOverview"
import type { ScheduleView } from "@/components/schedule/ViewToggle"

export default async function InternalCalendarPage({
  searchParams,
  // string | string[]: same repeated-param handling as the guest page.
}: { searchParams: Promise<{ branch?: string | string[]; week?: string | string[]; day?: string | string[]; view?: string | string[] }> }) {
  const profile = await requireProfile()
  const params = await searchParams
  const branches = await getBranches()
  const activeBranchId = resolveActiveBranchId(branches, params.branch)
  const view: ScheduleView = params.view === "week" ? "week" : "day"
  // Same single-day-view / week-fetch split as the guest page.
  const { selectedDate, monday } = resolveScheduleDates(params.day, params.week)
  await materializeWeek(monday)
  const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null

  // Phone numbers are staff-only — fetched here with the authenticated
  // client (passes students' RLS is_staff() check), never through
  // getScheduleData's anon client (which the guest-facing page also uses;
  // showing phone there would leak it to any anonymous visitor). Needed for
  // both views now — was previously gated to week only, which silently left
  // the day view (ScheduleGrid) without phone at all.
  let phoneByStudentId = new Map<string, string>()
  if (schedule) {
    const supabase = await createServerClient()
    const studentIds = [...new Set(schedule.registrations.map((r) => r.studentId))]
    if (studentIds.length > 0) {
      const { data: students } = await supabase.from("students").select("id, phone").in("id", studentIds)
      phoneByStudentId = new Map((students ?? []).map((s) => [s.id, s.phone]))
    }
  }

  return (
    <div className="min-w-0">
      <h1 className="mb-4 text-xl font-semibold">Lịch tự học</h1>
      <ScheduleToolbar branches={branches} activeBranchId={activeBranchId} selectedDate={selectedDate} monday={monday} view={view} />
      {schedule &&
        (view === "week" ? (
          <WeekOverview
            desks={schedule.desks}
            registrations={schedule.registrations}
            locks={schedule.locks}
            weekDates={getWeekDates(monday).map(toYmd)}
            branchId={activeBranchId}
            phoneByStudentId={phoneByStudentId}
          />
        ) : (
          <InternalScheduleGridClient
            desks={schedule.desks} date={selectedDate} registrations={schedule.registrations} locks={schedule.locks}
            canBook={profile.role === "admin"}
            phoneByStudentId={phoneByStudentId}
          />
        ))}
    </div>
  )
}
