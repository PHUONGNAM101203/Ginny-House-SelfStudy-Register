import { BranchTabs } from "@/components/schedule/BranchTabs"
import { DateNavigator } from "@/components/schedule/DateNavigator"
import { WeekNavigator } from "@/components/schedule/WeekNavigator"
import { ViewToggle, type ScheduleView } from "@/components/schedule/ViewToggle"

/**
 * The chrome above the schedule grid: branch switch + day/week navigation,
 * laid out as one bar (controls on top, week strip full-width underneath in
 * day view).
 *
 * Shared by the guest page and /noi-bo/lich so both get the same navigation
 * UX. Lives outside the grid's horizontally scrolling container on purpose —
 * only the desk columns scroll sideways, never the controls.
 */
export function ScheduleToolbar({
  branches,
  activeBranchId,
  selectedDate,
  monday,
  view,
}: {
  branches: { id: string; name: string }[]
  activeBranchId?: string
  /** "yyyy-MM-dd" — a calendar day, not an instant (see lib/vn-date.ts). */
  selectedDate: string
  monday: Date
  view: ScheduleView
}) {
  const branchTabs = activeBranchId && (
    // Branch tabs can outgrow a phone width once there are several
    // branches, so they get their own scroller instead of pushing the
    // page sideways.
    <div className="-mx-1 min-w-0 max-w-full overflow-x-auto px-1 py-0.5">
      <BranchTabs branches={branches} activeBranchId={activeBranchId} />
    </div>
  )

  return (
    <div className="mb-4 flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {branchTabs}
        <ViewToggle view={view} />
      </div>
      {view === "week" ? <WeekNavigator monday={monday} /> : <DateNavigator selectedDate={selectedDate} />}
    </div>
  )
}
