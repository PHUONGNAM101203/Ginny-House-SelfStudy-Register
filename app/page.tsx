import { getBranches, getScheduleData } from "@/lib/schedule-data"
import { getMondayOfWeek } from "@/lib/week"
import { BranchTabs } from "@/components/schedule/BranchTabs"
import { WeekPicker } from "@/components/schedule/WeekPicker"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; week?: string }>
}) {
  const params = await searchParams
  const branches = await getBranches()
  const activeBranchId = params.branch ?? branches[0]?.id
  const monday = getMondayOfWeek(params.week ? new Date(params.week) : new Date())
  const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null

  return (
    <div className="mx-auto max-w-6xl p-4">
      <h1 className="mb-4 text-xl font-semibold">Đăng ký chỗ tự học</h1>
      <div className="mb-4 flex items-center justify-between">
        {activeBranchId && <BranchTabs branches={branches} activeBranchId={activeBranchId} />}
        <WeekPicker monday={monday} />
      </div>
      {schedule && (
        <p className="text-sm text-muted-foreground">
          {schedule.desks.length} chỗ, {schedule.registrations.length} lượt đăng ký tuần này.
        </p>
      )}
    </div>
  )
}
