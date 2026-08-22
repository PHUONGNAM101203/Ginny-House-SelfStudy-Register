import Link from "next/link"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { computeOccupancy } from "@/lib/dashboard"
import { parseYmd, vietnamToday } from "@/lib/vn-date"
import { cn } from "@/lib/utils"

type Desk = { id: string; label: string }
type Registration = { deskId: string; date: string; startTime: string; endTime: string }
type SlotLock = { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }

/**
 * Week-at-a-glance: one row per day, each showing how full that day already
 * is across every desk (both the morning and afternoon–evening blocks
 * combined) rather than the single-day grid's 30-minute-slot detail. A
 * vertical list rather than a 7-column table on purpose — a table narrow
 * enough to fit a phone without horizontal scroll leaves no room for the
 * count, so this reads the same on every width instead of being a squeezed
 * version of a desktop layout.
 *
 * Each row links back into the single-day view for that date, so the
 * overview is a way to find which day to open, not a dead end.
 */
export function WeekOverview({
  desks,
  registrations,
  locks,
  weekDates,
  branchId,
}: {
  desks: Desk[]
  registrations: Registration[]
  locks: SlotLock[]
  /** Seven "yyyy-MM-dd" strings, Monday through Sunday (see lib/vn-date.ts). */
  weekDates: string[]
  branchId?: string
}) {
  if (desks.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Cơ sở này chưa có chỗ ngồi nào đang mở.
      </p>
    )
  }

  const occupancy = computeOccupancy(desks, registrations, locks, weekDates)
  const todayStr = vietnamToday()

  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Tổng quan cả tuần">
      {weekDates.map((dateStr) => {
        const rows = occupancy.filter((o) => o.date === dateStr)
        const totalSlots = rows.reduce((sum, r) => sum + r.totalSlots, 0)
        const bookedSlots = rows.reduce((sum, r) => sum + r.bookedSlots, 0)
        const rate = totalSlots === 0 ? 0 : bookedSlots / totalSlots
        const date = parseYmd(dateStr)
        const isToday = dateStr === todayStr
        const href = `?${new URLSearchParams({ ...(branchId ? { branch: branchId } : {}), day: dateStr, view: "day" }).toString()}`

        return (
          <Link
            key={dateStr}
            href={href}
            role="listitem"
            className={cn(
              "flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent",
              isToday && "border-primary/50 bg-primary/5"
            )}
          >
            <div className="w-20 shrink-0">
              <div className={cn("text-xs font-semibold uppercase", isToday ? "text-primary" : "text-muted-foreground")}>
                {format(date, "EEEE", { locale: vi })}
              </div>
              <div className={cn("text-sm font-medium tabular-nums", isToday && "text-primary")}>
                {format(date, "dd/MM", { locale: vi })}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round(rate * 100)}%` }}
                />
              </div>
            </div>
            <div className="w-20 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
              {bookedSlots}/{totalSlots}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
