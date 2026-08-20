import { requireProfile } from "@/lib/auth"
import { getBranches, getScheduleData, materializeWeek } from "@/lib/schedule-data"
import { resolveScheduleDates } from "@/lib/schedule-params"
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar"
import { InternalScheduleGridClient } from "@/components/schedule/InternalScheduleGridClient"

export default async function InternalCalendarPage({
  searchParams,
  // string | string[]: same repeated-param handling as the guest page.
}: { searchParams: Promise<{ branch?: string | string[]; week?: string | string[]; day?: string | string[] }> }) {
  const profile = await requireProfile()
  const params = await searchParams
  const branches = await getBranches()
  const activeBranchId = (typeof params.branch === "string" ? params.branch : undefined) ?? branches[0]?.id
  // Same single-day-view / week-fetch split as the guest page.
  const { selectedDate, monday } = resolveScheduleDates(params.day, params.week)
  await materializeWeek(monday)
  const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null

  return (
    <div className="min-w-0">
      <h1 className="mb-4 text-xl font-semibold">Lịch tự học</h1>
      <ScheduleToolbar branches={branches} activeBranchId={activeBranchId} selectedDate={selectedDate} />
      {schedule && (
        <InternalScheduleGridClient
          desks={schedule.desks} date={selectedDate} registrations={schedule.registrations} locks={schedule.locks}
          canBook={profile.role === "admin"}
        />
      )}
    </div>
  )
}
