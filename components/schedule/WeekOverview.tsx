import Link from "next/link"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { TIME_SLOTS, type TimeSlot } from "@/lib/time-slots"
import { parseYmd, vietnamToday } from "@/lib/vn-date"
import { cn } from "@/lib/utils"

type Desk = { id: string; label: string }
type Registration = { deskId: string; date: string; startTime: string; endTime: string; studentName: string; className: string | null }
type SlotLock = { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }

// Same weekday abbreviations as DateNavigator's own strip, so the two read
// as one navigation vocabulary rather than two different labelling schemes.
const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

// Morning ends before the afternoon block starts (see lib/time-slots.ts's
// RANGES) — splitting TIME_SLOTS on that gap reproduces the same two blocks
// ScheduleGrid renders for a single day, without a second copy of the
// business hours living here.
//
// `end` is the block's real closing boundary (12:00 / 22:00). TIME_SLOTS
// only carries slot *start* times, so a plain filter's last row is
// 11:30/21:30 — same class of gap ScheduleGrid's boundaryRowMax() fixes for
// the single-day RBC grid: a grid that stops at 11:30 visually reads as not
// reaching the 12:00 the block label promises. Here (a plain HTML table, not
// RBC) the fix is a trailing boundary row appended below the slot rows, not
// a `max` prop — same intent: a real, native, non-clickable closing tick row
// rather than a label invented outside the grid.
const BLOCKS = [
  { label: "Buổi sáng", end: "12:00", slots: TIME_SLOTS.filter((s) => s.start < "12:00") },
  { label: "Buổi chiều – tối", end: "22:00", slots: TIME_SLOTS.filter((s) => s.start >= "14:00") },
] as const

function isoDayOfWeek(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00Z`)
  return ((date.getUTCDay() + 6) % 7) + 1
}

// Returns every registration whose desk is open (not locked) for this
// date/slot, alongside how many desks are open at all — matches ScheduleGrid's
// own overlap check (start < slot.end && end > slot.start) so a cell here
// agrees with what the day view would show for the same slot.
function cellRegistrations(desks: Desk[], registrations: Registration[], locks: SlotLock[], date: string, slot: TimeSlot) {
  const isoDow = isoDayOfWeek(date)
  const availableDeskIds = new Set(
    desks
      .filter(
        (d) =>
          !locks.some(
            (l) => (l.deskId === d.id || l.deskId === null) && l.dayOfWeek === isoDow && l.startTime < slot.end && l.endTime > slot.start
          )
      )
      .map((d) => d.id)
  )
  const matches = registrations.filter(
    (r) => availableDeskIds.has(r.deskId) && r.date === date && r.startTime < slot.end && r.endTime > slot.start
  )
  return { totalDesks: availableDeskIds.size, matches }
}

/**
 * Week-at-a-glance as an actual calendar grid — time down the left the same
 * way the single-day view reads, seven day columns across the top instead
 * of one, split into the same morning / afternoon–evening blocks. Each cell
 * shows the booked student's name (same "Tên · Lớp" format as the day
 * view's event chips) so it reads as who's booked, not just a density
 * heatmap — a cell with more than one booking (multiple desks, same slot)
 * shows the first name plus a "+N" count. Each cell still links into the
 * single-day view for that date, so seeing every desk in a busy slot is one
 * click away.
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
                    const { totalDesks, matches } = cellRegistrations(desks, registrations, locks, dateStr, slot)
                    const first = matches[0]
                    const label =
                      totalDesks === 0
                        ? "Không có chỗ"
                        : matches.length === 0
                          ? "Còn trống"
                          : matches.map((m) => (m.className ? `${m.studentName} · ${m.className}` : m.studentName)).join(", ")
                    return (
                      <td key={dateStr} className="border-b border-l border-border p-0">
                        <Link
                          href={`?${new URLSearchParams({ ...(branchId ? { branch: branchId } : {}), day: dateStr, view: "day" }).toString()}`}
                          // Same fixed light-tint chip look as the day view's
                          // .rbc-event (app/globals.css) rather than a
                          // density-scaled opacity — a saturated fill at high
                          // occupancy would make the name unreadable.
                          className={cn(
                            "flex h-7 w-full items-center justify-center gap-1 overflow-hidden px-1 text-[11px] leading-none font-medium transition-[outline] hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-primary/50",
                            totalDesks === 0 && "bg-muted"
                          )}
                          style={
                            first
                              ? { backgroundColor: "color-mix(in oklch, var(--primary) 12%, var(--card))", color: "var(--primary)" }
                              : undefined
                          }
                          aria-label={`${format(parseYmd(dateStr), "EEEE dd/MM", { locale: vi })} ${slot.start}: ${label}`}
                          title={label}
                        >
                          {first && (
                            <span className="truncate">{first.className ? `${first.studentName} · ${first.className}` : first.studentName}</span>
                          )}
                          {matches.length > 1 && <span className="shrink-0 text-muted-foreground">+{matches.length - 1}</span>}
                        </Link>
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 border-t border-border bg-card p-1.5 text-xs text-muted-foreground tabular-nums">{block.end}</td>
                {weekDates.map((dateStr) => (
                  <td key={dateStr} className="h-7 border-t border-l border-border bg-muted/40" />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
