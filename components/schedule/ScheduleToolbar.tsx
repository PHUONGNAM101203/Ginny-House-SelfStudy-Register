import { BranchTabs } from "@/components/schedule/BranchTabs"
import { DateNavigator } from "@/components/schedule/DateNavigator"

/**
 * The chrome above the schedule grid: branch switch + day navigation, laid out
 * as one bar (controls on top, week strip full-width underneath).
 *
 * Shared by the guest page and /noi-bo/lich so both get the same navigation
 * UX. Lives outside the grid's horizontally scrolling container on purpose —
 * only the desk columns scroll sideways, never the controls.
 */
export function ScheduleToolbar({
  branches,
  activeBranchId,
  selectedDate,
}: {
  branches: { id: string; name: string }[]
  activeBranchId?: string
  /** "yyyy-MM-dd" — a calendar day, not an instant (see lib/vn-date.ts). */
  selectedDate: string
}) {
  return (
    <div className="mb-4 flex min-w-0 rounded-lg border border-border bg-card p-3">
      <DateNavigator
        selectedDate={selectedDate}
        leading={
          activeBranchId && (
            // Branch tabs can outgrow a phone width once there are several
            // branches, so they get their own scroller instead of pushing the
            // page sideways.
            <div className="-mx-1 min-w-0 max-w-full overflow-x-auto px-1 py-0.5">
              <BranchTabs branches={branches} activeBranchId={activeBranchId} />
            </div>
          )
        }
      />
    </div>
  )
}
