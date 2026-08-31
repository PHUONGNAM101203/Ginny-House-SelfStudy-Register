import Link from "next/link"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { TIME_SLOTS, type TimeSlot } from "@/lib/time-slots"
import { parseYmd, vietnamToday } from "@/lib/vn-date"
import { cn } from "@/lib/utils"

type Desk = { id: string; label: string }
type Registration = {
  id: string
  studentId: string
  deskId: string
  date: string
  startTime: string
  endTime: string
  studentName: string
  className: string | null
  recurringRegistrationId: string | null
}
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

function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number)
  return h * 60 + m
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

type CellPlanEntry =
  | { skip: true }
  | { skip: false; rowSpan: number; totalDesks: number; matches: Registration[] }

// A registration spanning several consecutive 30-minute slots used to repeat
// its name on every row it covered (four rows all reading "Gin Anh" for a
// 2-hour booking). This merges the slots it covers into one rowSpan cell —
// a single card centered over the whole span — instead.
//
// The span is computed directly from the primary registration's own
// `endTime` (ground truth), not by re-checking "is matches[0] still the same
// id" slot by slot — that re-derivation was the actual bug: when a SECOND
// registration on a different desk starts partway through the first one's
// range, array ordering can make it sort before the first registration at
// that later slot, so matches[0]'s identity "changes" even though the
// original booking is still running — which silently cut the merged card
// short and left the rest of that booking's own slots rendering as blank.
// Reading the end time straight off the registration sidesteps that
// entirely: the card always covers exactly what the booking says it does,
// regardless of what else is happening in other desks at the same time.
function computeColumnPlan(desks: Desk[], registrations: Registration[], locks: SlotLock[], date: string, slots: readonly TimeSlot[]): CellPlanEntry[] {
  const plan: CellPlanEntry[] = []
  let i = 0
  while (i < slots.length) {
    const { totalDesks, matches } = cellRegistrations(desks, registrations, locks, date, slots[i])
    const primary = matches[0]
    if (!primary) {
      plan.push({ skip: false, rowSpan: 1, totalDesks, matches })
      i++
      continue
    }
    const endMinutes = minutesOf(primary.endTime)
    let span = 1
    while (i + span < slots.length && minutesOf(slots[i + span].start) < endMinutes) {
      span++
    }
    plan.push({ skip: false, rowSpan: span, totalDesks, matches })
    for (let k = 1; k < span; k++) plan.push({ skip: true })
    i += span
  }
  return plan
}

/**
 * Week-at-a-glance as an actual calendar grid — time down the left the same
 * way the single-day view reads, seven day columns across the top instead
 * of one, split into the same morning / afternoon–evening blocks. A booking
 * spanning multiple slots renders as one merged card (rowSpan) centered over
 * its whole time range — name, class, and (staff view only) phone — instead
 * of repeating the name on every row it covers. Each cell still links into
 * the single-day view for that date, so seeing every desk in a busy slot is
 * one click away.
 */
export function WeekOverview({
  desks,
  registrations,
  locks,
  weekDates,
  branchId,
  phoneByStudentId,
}: {
  desks: Desk[]
  registrations: Registration[]
  locks: SlotLock[]
  /** Seven "yyyy-MM-dd" strings, Monday through Sunday (see lib/vn-date.ts). */
  weekDates: string[]
  branchId?: string
  /**
   * Staff-only. Omitted entirely on the guest-facing page (which fetches
   * registrations with the anon client — students.phone RLS only allows
   * is_staff() reads, and even if it didn't, the public calendar must never
   * show one guest's phone number to another).
   */
  phoneByStudentId?: Map<string, string>
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
      {BLOCKS.map((block) => {
        const columnPlans = weekDates.map((dateStr) => computeColumnPlan(desks, registrations, locks, dateStr, block.slots))
        return (
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
                {block.slots.map((slot, slotIndex) => (
                  <tr key={slot.start}>
                    <td className="sticky left-0 border-b border-border bg-card p-1.5 text-xs text-muted-foreground tabular-nums">
                      {slot.start}
                    </td>
                    {weekDates.map((dateStr, dayIndex) => {
                      const cell = columnPlans[dayIndex][slotIndex]
                      if (cell.skip) return null
                      const { totalDesks, matches, rowSpan } = cell
                      const first = matches[0]
                      const phone = first ? phoneByStudentId?.get(first.studentId) : undefined
                      const label =
                        totalDesks === 0
                          ? "Không có chỗ"
                          : matches.length === 0
                            ? "Còn trống"
                            : matches.map((m) => (m.className ? `${m.studentName} · ${m.className}` : m.studentName)).join(", ")
                      return (
                        <td key={dateStr} rowSpan={rowSpan} className="border-b border-l border-border p-0 align-middle">
                          <Link
                            href={`?${new URLSearchParams({ ...(branchId ? { branch: branchId } : {}), day: dateStr, view: "day" }).toString()}`}
                            // Same fixed light-tint chip look as the day view's
                            // .rbc-event (app/globals.css) rather than a
                            // density-scaled opacity — a saturated fill at high
                            // occupancy would make the name unreadable.
                            className={cn(
                              "flex h-full min-h-7 w-full flex-col items-center justify-center gap-0.5 overflow-hidden px-1 py-1 text-center text-[11px] leading-tight font-medium transition-[outline] hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-primary/50",
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
                              <>
                                <span className="w-full truncate">
                                  {first.studentName}
                                  {first.className && ` · ${first.className}`}
                                </span>
                                {phone && <span className="w-full truncate text-[10px] font-normal opacity-80">{phone}</span>}
                                <span className="w-full truncate text-[10px] font-normal opacity-70">
                                  {first.recurringRegistrationId ? "Lịch cố định" : "Lịch bình thường"}
                                </span>
                              </>
                            )}
                            {matches.length > 1 && <span className="shrink-0 text-[10px] font-normal opacity-80">+{matches.length - 1}</span>}
                          </Link>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="sticky left-0 border-t border-border bg-card p-1.5 text-xs text-muted-foreground tabular-nums">{block.end}</td>
                  {weekDates.map((dateStr) => (
                    <td key={dateStr} className="h-7 border-t border-l border-border" />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
