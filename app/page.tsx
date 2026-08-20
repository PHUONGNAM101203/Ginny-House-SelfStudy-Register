import { getBranches, getScheduleData, materializeWeek } from "@/lib/schedule-data"
import { getMondayOfWeek } from "@/lib/week"
import { BranchTabs } from "@/components/schedule/BranchTabs"
import { WeekPicker } from "@/components/schedule/WeekPicker"
import { ScheduleGridClient } from "@/components/schedule/ScheduleGridClient"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import BrandMark from "@/components/brand/BrandMark"

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string; week?: string }>
}) {
  const params = await searchParams
  const branches = await getBranches()
  const activeBranchId = params.branch ?? branches[0]?.id
  const monday = getMondayOfWeek(params.week ? new Date(params.week) : new Date())
  await materializeWeek(monday)
  const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null

  return (
    // w-full min-w-0: this div is a flex item of <body className="flex h-full
    // flex-col"> (app/layout.tsx). Flex items default to min-width: auto,
    // which refuses to shrink below their content's min-content size — the
    // desk-column calendar grid's intrinsic width is much wider than a phone
    // viewport, so without an explicit width the whole *page* scrolled
    // horizontally instead of just each day's own overflow-x-auto wrapper
    // (found while re-verifying mobile width for Task 8b's dark-mode fix).
    <div className="mx-auto w-full min-w-0 max-w-6xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrandMark className="size-8" priority />
          <h1 className="text-xl font-semibold">Đăng ký chỗ tự học</h1>
        </div>
        <ThemeToggle />
      </div>
      <div className="mb-4 flex items-center justify-between">
        {activeBranchId && <BranchTabs branches={branches} activeBranchId={activeBranchId} />}
        <WeekPicker monday={monday} />
      </div>
      {schedule && (
        <ScheduleGridClient
          desks={schedule.desks}
          monday={monday}
          registrations={schedule.registrations}
          locks={schedule.locks}
        />
      )}
    </div>
  )
}
