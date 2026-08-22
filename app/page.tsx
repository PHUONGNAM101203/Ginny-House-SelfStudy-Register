import { getBranches, getScheduleData, materializeWeek } from "@/lib/schedule-data"
import { resolveScheduleDates } from "@/lib/schedule-params"
import { resolveActiveBranchId } from "@/lib/branches"
import { getWeekDates } from "@/lib/week"
import { toYmd } from "@/lib/vn-date"
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar"
import { ScheduleGridClient } from "@/components/schedule/ScheduleGridClient"
import { WeekOverview } from "@/components/schedule/WeekOverview"
import { AppHeader } from "@/components/layout/AppHeader"
import type { ScheduleView } from "@/components/schedule/ViewToggle"

export default async function HomePage({
  searchParams,
}: {
  // string | string[]: Next hands back an array for a repeated param, so the
  // types must admit it rather than trusting a bare string (resolveScheduleDates
  // rejects the array form).
  searchParams: Promise<{ branch?: string | string[]; week?: string | string[]; day?: string | string[]; view?: string | string[] }>
}) {
  const params = await searchParams
  const branches = await getBranches()
  const activeBranchId = resolveActiveBranchId(branches, params.branch)
  const view: ScheduleView = params.view === "week" ? "week" : "day"
  // The grid shows one day; the fetch still covers that day's whole week (see
  // lib/schedule-params.ts for why the two params always travel together) —
  // the week overview reuses that same fetch instead of querying again.
  const { selectedDate, monday } = resolveScheduleDates(params.day, params.week)
  await materializeWeek(monday)
  const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null

  return (
    <>
      <AppHeader profile={null} />
      {/* w-full min-w-0: this div is a flex item of <body className="flex h-full
          flex-col"> (app/layout.tsx). Flex items default to min-width: auto,
          which refuses to shrink below their content's min-content size — the
          desk-column calendar grid's intrinsic width is much wider than a phone
          viewport, so without an explicit width the whole *page* scrolled
          horizontally instead of just the grid's own overflow-x-auto wrapper
          (found while re-verifying mobile width for Task 8b's dark-mode fix). */}
      <main className="mx-auto w-full min-w-0 max-w-[1600px] p-4">
        <h1 className="mb-4 text-xl font-semibold">Đăng ký chỗ tự học</h1>
        <ScheduleToolbar branches={branches} activeBranchId={activeBranchId} selectedDate={selectedDate} monday={monday} view={view} />
        {schedule &&
          (view === "week" ? (
            <WeekOverview
              desks={schedule.desks}
              registrations={schedule.registrations}
              locks={schedule.locks}
              weekDates={getWeekDates(monday).map(toYmd)}
              branchId={activeBranchId}
            />
          ) : (
            <ScheduleGridClient
              desks={schedule.desks}
              date={selectedDate}
              registrations={schedule.registrations}
              locks={schedule.locks}
            />
          ))}
      </main>
    </>
  )
}
