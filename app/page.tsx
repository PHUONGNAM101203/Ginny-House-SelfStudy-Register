import { getBranches, getScheduleData, materializeWeek } from "@/lib/schedule-data"
import { resolveScheduleDates } from "@/lib/schedule-params"
import { ScheduleToolbar } from "@/components/schedule/ScheduleToolbar"
import { ScheduleGridClient } from "@/components/schedule/ScheduleGridClient"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { VietnamClock } from "@/components/layout/VietnamClock"
import BrandMark from "@/components/brand/BrandMark"

export default async function HomePage({
  searchParams,
}: {
  // string | string[]: Next hands back an array for a repeated param, so the
  // types must admit it rather than trusting a bare string (resolveScheduleDates
  // rejects the array form).
  searchParams: Promise<{ branch?: string | string[]; week?: string | string[]; day?: string | string[] }>
}) {
  const params = await searchParams
  const branches = await getBranches()
  const activeBranchId = (typeof params.branch === "string" ? params.branch : undefined) ?? branches[0]?.id
  // The grid shows one day; the fetch still covers that day's whole week (see
  // lib/schedule-params.ts for why the two params always travel together).
  const { selectedDate, monday } = resolveScheduleDates(params.day, params.week)
  await materializeWeek(monday)
  const schedule = activeBranchId ? await getScheduleData(activeBranchId, monday) : null

  return (
    // w-full min-w-0: this div is a flex item of <body className="flex h-full
    // flex-col"> (app/layout.tsx). Flex items default to min-width: auto,
    // which refuses to shrink below their content's min-content size — the
    // desk-column calendar grid's intrinsic width is much wider than a phone
    // viewport, so without an explicit width the whole *page* scrolled
    // horizontally instead of just the grid's own overflow-x-auto wrapper
    // (found while re-verifying mobile width for Task 8b's dark-mode fix).
    <div className="mx-auto w-full min-w-0 max-w-[1600px] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BrandMark className="size-8" priority />
          <h1 className="truncate text-xl font-semibold">Đăng ký chỗ tự học</h1>
        </div>
        <div className="flex items-center gap-2">
          <VietnamClock />
          <ThemeToggle />
        </div>
      </div>
      <ScheduleToolbar branches={branches} activeBranchId={activeBranchId} selectedDate={selectedDate} />
      {schedule && (
        <ScheduleGridClient
          desks={schedule.desks}
          date={selectedDate}
          registrations={schedule.registrations}
          locks={schedule.locks}
        />
      )}
    </div>
  )
}
