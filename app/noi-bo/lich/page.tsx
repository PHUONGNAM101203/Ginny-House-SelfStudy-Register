import { requireProfile } from "@/lib/auth"
import { getBranches, getScheduleData, materializeWeek } from "@/lib/schedule-data"
import { getMondayOfWeek } from "@/lib/week"
import { BranchTabs } from "@/components/schedule/BranchTabs"
import { WeekPicker } from "@/components/schedule/WeekPicker"
import { InternalScheduleGridClient } from "@/components/schedule/InternalScheduleGridClient"

export default async function InternalCalendarPage({
  searchParams,
}: { searchParams: Promise<{ branch?: string; week?: string }> }) {
  const profile = await requireProfile()
  const params = await searchParams
  const branches = await getBranches()
  const activeBranchId = params.branch ?? branches[0]?.id
  const monday = getMondayOfWeek(params.week ? new Date(params.week) : new Date())
  await materializeWeek(monday)
  const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Lịch tự học</h1>
      <div className="mb-4 flex items-center justify-between">
        {activeBranchId && <BranchTabs branches={branches} activeBranchId={activeBranchId} />}
        <WeekPicker monday={monday} />
      </div>
      {schedule && (
        <InternalScheduleGridClient
          desks={schedule.desks} monday={monday} registrations={schedule.registrations} locks={schedule.locks}
          canBook={profile.role === "admin"}
        />
      )}
    </div>
  )
}
