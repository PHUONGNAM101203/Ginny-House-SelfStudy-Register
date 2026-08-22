import Link from "next/link"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { TIME_SLOTS, type TimeSlot } from "@/lib/time-slots"
import { parseYmd, vietnamToday } from "@/lib/vn-date"
import { cn } from "@/lib/utils"

type Desk = { id: string; label: string }
type Registration = { deskId: string; date: string; startTime: string; endTime: string }
type SlotLock = { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }

// Same weekday abbreviations as DateNavigator's own strip, so the two read
// as one navigation vocabulary rather than two different labelling schemes.
const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

// Morning ends before the afternoon block starts (see lib/time-slots.ts's
// RANGES) — splitting TIME_SLOTS on that gap reproduces the same two blocks
// ScheduleGrid renders for a single day, without a second copy of the
// business hours living here.
const BLOCKS = [
  { label: "Buổi sáng", slots: TIME_SLOTS.filter((s) => s.start < "12:00") },
  { label: "Buổi chiều – tối", slots: TIME_SLOTS.filter((s) => s.start >= "14:00") },
] as const

function isoDayOfWeek(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00Z`)
  return ((date.getUTCDay() + 6) % 7) + 1
}

function cellStat(desks: Desk[], registrations: Registration[], locks: SlotLock[], date: string, slot: TimeSlot) {
  const isoDow = isoDayOfWeek(date)
  const availableDesks = desks.filter(
    (d) =>
      !locks.some(
        (l) => (l.deskId === d.id || l.deskId === null) && l.dayOfWeek === isoDow && l.startTime < slot.end && l.endTime > slot.start
      )
  )
  const bookedDesks = availableDesks.filter((d) =>
    registrations.some((r) => r.deskId === d.id && r.date === date && r.startTime < slot.end && r.endTime > slot.start)
  ).length
  return { totalDesks: availableDesks.length, bookedDesks }
}

/**
 * Week-at-a-glance as an actual calendar grid — time down the left the same
 * way the single-day view reads, seven day columns across the top instead
 * of one, split into the same morning / afternoon–evening blocks. Desk
 * detail collapses into one booked-vs-open count per cell (a real 10-desks-
 * by-7-days grid would need 70 columns, which stops being an "at a glance"
 * view on any screen); each cell still links into the single-day view for
 * that date, so drilling into who's actually booked is one click away.
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

  const todayStr = vietnamToday()

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {BLOCKS.map((block) => (
        <div key={block.label} className="min-w-0 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <caption className="sr-only">{block.label}</caption>
            <thead>
              <tr>
                <th className="sticky left-0 w-14 border-b border-border bg-card p-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {block.label}
                </th>
                {weekDates.map((dateStr) => {
                  const date = parseYmd(dateStr)
                  const isToday = dateStr === todayStr
                  return (
                    <th
                      key={dateStr}
                      className={cn(
                        "border-b border-l border-border p-2 text-center text-xs font-semibold uppercase",
                        isToday ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      <div>{WEEKDAY_LABELS[(date.getDay() + 6) % 7]}</div>
                      <div className={cn("text-sm font-medium normal-case tabular-nums", isToday && "text-primary")}>
                        {format(date, "dd/MM")}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {block.slots.map((slot) => (
                <tr key={slot.start}>
                  <td className="sticky left-0 border-b border-border bg-card p-1.5 text-xs text-muted-foreground tabular-nums">
                    {slot.start}
                  </td>
                  {weekDates.map((dateStr) => {
                    const { totalDesks, bookedDesks } = cellStat(desks, registrations, locks, dateStr, slot)
                    const rate = totalDesks === 0 ? 0 : bookedDesks / totalDesks
                    const label = totalDesks === 0 ? "Không có chỗ" : `${bookedDesks}/${totalDesks} đã đặt`
                    return (
                      <td key={dateStr} className="border-b border-l border-border p-0">
                        <Link
                          href={`?${new URLSearchParams({ ...(branchId ? { branch: branchId } : {}), day: dateStr, view: "day" }).toString()}`}
                          className="flex h-7 w-full items-center justify-center transition-[outline] hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-primary/50"
                          // Booking density as fill opacity, the same visual
                          // language a real calendar's "busy" shading uses —
                          // an empty cell (rate 0) is left transparent so it
                          // reads exactly like an open slot in the day grid.
                          style={rate > 0 ? { backgroundColor: `color-mix(in oklch, var(--primary) ${Math.round(rate * 85 + 15)}%, transparent)` } : undefined}
                          aria-label={`${format(parseYmd(dateStr), "EEEE dd/MM", { locale: vi })} ${slot.start}: ${label}`}
                          title={label}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
