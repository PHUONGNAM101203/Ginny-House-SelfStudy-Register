"use client"

import Link from "next/link"
import { format } from "date-fns"
import { vi } from "date-fns/locale"
import { TIME_SLOTS, type TimeSlot } from "@/lib/time-slots"
import { parseYmd, vietnamToday } from "@/lib/vn-date"
import { cn } from "@/lib/utils"
import { bookingKind, BOOKING_KIND_LABEL, BOOKING_KIND_STYLE } from "@/lib/booking-kind"

type Desk = { id: string; label: string }
type Registration = {
  id: string
  studentId: string | null
  deskId: string
  date: string
  startTime: string
  endTime: string
  studentName: string | null
  className: string | null
  recurringRegistrationId: string | null
  /** Cancelled bookings reach this component on internal pages only. */
  status?: "active" | "cancelled"
}
type SlotLock = { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }

/** What a chip hands back when clicked — the same shape ScheduleGrid's onSlotClick uses. */
export type WeekBookingClick = {
  desk: Desk
  date: string
  startTime: string
  endTime: string
  registration: Registration
}

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

/**
 * What belongs in one (day, slot) cell.
 *
 * `starting` is only the bookings that BEGIN in this slot; one that runs
 * through from earlier is counted in `overlapping` but not drawn again. That
 * is what keeps every booking on screen exactly once, at its real start time.
 *
 * The previous version merged the whole day column into one rowSpan card per
 * slot, showing matches[0] and a "+N". It hid most of the day and misplaced
 * the rest: on a real Saturday with 8 bookings it drew 3 cards, said "+1"
 * while concealing six, and rendered a 14:30 booking on the 17:00 row because
 * that was the first row the earlier card's span had not swallowed.
 */
function cellBookings(desks: Desk[], registrations: Registration[], locks: SlotLock[], date: string, slot: TimeSlot) {
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
  // Same overlap test as ScheduleGrid, so a cell here agrees with the day view.
  const overlapping = registrations.filter(
    (r) => availableDeskIds.has(r.deskId) && r.date === date && r.startTime < slot.end && r.endTime > slot.start
  )
  const starting = overlapping
    .filter((r) => r.startTime >= slot.start && r.startTime < slot.end)
    // Sorted so the order is stable between renders rather than following
    // whatever order the rows came back in.
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || (a.studentName ?? "").localeCompare(b.studentName ?? ""))
  return { totalDesks: availableDeskIds.size, overlapping, starting }
}

/**
 * Week-at-a-glance as an actual calendar grid — time down the left the same
 * way the single-day view reads, seven day columns across the top instead of
 * one, split into the same morning / afternoon–evening blocks. Every booking
 * gets its own chip on the row where it starts, carrying its real time range,
 * who it is for, which desk it holds, and which kind of lịch it is.
 *
 * Clicking a chip opens the same detail dialog the day view opens (via
 * onBookingClick); clicking the rest of the cell still drops into the
 * single-day view for that date.
 */
export function WeekOverview({
  desks,
  registrations,
  locks,
  weekDates,
  branchId,
  phoneByStudentId,
  onBookingClick,
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
  /**
   * Omitted = chips are plain, unclickable text (the grid still works, it
   * just has no detail dialog behind it). The two page wrappers supply it.
   */
  onBookingClick?: (payload: WeekBookingClick) => void
}) {
  if (desks.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Cơ sở này chưa có chỗ ngồi nào đang mở.
      </p>
    )
  }

  const todayStr = vietnamToday()
  // Which desk a booking holds is the fact quản sinh needs most when reading
  // the week — "đăng ký chỗ nào" — so every chip prints it.
  const deskById = new Map(desks.map((d) => [d.id, d]))

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {BLOCKS.map((block) => {
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
                {block.slots.map((slot) => (
                  <tr key={slot.start}>
                    <td className="sticky left-0 border-b border-border bg-card p-1.5 text-xs text-muted-foreground tabular-nums">
                      {slot.start}
                    </td>
                    {weekDates.map((dateStr) => {
                      const { totalDesks, overlapping, starting } = cellBookings(desks, registrations, locks, dateStr, slot)
                      const free = totalDesks - overlapping.length
                      const label =
                        totalDesks === 0
                          ? "Không có chỗ"
                          : starting.length > 0
                            ? starting
                                .map(
                                  (m) =>
                                    `${m.startTime}–${m.endTime} ${m.studentName ?? BOOKING_KIND_LABEL.vacant} · ${deskById.get(m.deskId)?.label ?? ""} (${BOOKING_KIND_LABEL[bookingKind(m)]})`
                                )
                                .join(", ")
                            : free > 0
                              ? `Còn ${free} chỗ`
                              : "Hết chỗ"
                      const href = `?${new URLSearchParams({ ...(branchId ? { branch: branchId } : {}), day: dateStr, view: "day" }).toString()}`
                      return (
                        <td key={dateStr} className="relative border-b border-l border-border p-0 align-top">
                          {/* The click-through to the single-day view sits
                              *behind* the chips rather than wrapping them: a
                              <button> inside an <a> is invalid, and the chips
                              have their own job now (open the detail dialog). */}
                          <Link
                            href={href}
                            className={cn(
                              "absolute inset-0 transition-[outline] hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-primary/50",
                              // Same diagonal hatching as the day grid's locked
                              // slots (app/globals.css) — a plain muted fill was
                              // being read as bookable.
                              totalDesks === 0 && "schedule-locked-hatch"
                            )}
                            aria-label={`${format(parseYmd(dateStr), "EEEE dd/MM", { locale: vi })} ${slot.start}: ${label}`}
                            title={label}
                          />
                          <div className="pointer-events-none relative flex min-h-7 w-full flex-col gap-0.5 p-0.5">
                            {starting.map((m) => {
                              const kind = bookingKind(m)
                              const desk = deskById.get(m.deskId)
                              const phone = m.studentId ? phoneByStudentId?.get(m.studentId) : undefined
                              const Chip = onBookingClick ? "button" : "span"
                              return (
                                <Chip
                                  key={m.id}
                                  {...(onBookingClick
                                    ? {
                                        type: "button" as const,
                                        onClick: () =>
                                          desk &&
                                          onBookingClick({
                                            desk,
                                            date: m.date,
                                            startTime: m.startTime,
                                            endTime: m.endTime,
                                            registration: m,
                                          }),
                                      }
                                    : {})}
                                  className={cn(
                                    "pointer-events-auto flex w-full flex-col overflow-hidden rounded-sm px-1 py-0.5 text-left text-[11px] leading-tight font-medium",
                                    onBookingClick && "cursor-pointer transition-[outline] hover:outline hover:outline-2 hover:-outline-offset-2 hover:outline-primary/60"
                                  )}
                                  style={BOOKING_KIND_STYLE[kind]}
                                >
                                  <span className="w-full truncate tabular-nums opacity-70">
                                    {/* en dash, matching how the day grid
                                        renders its own time range */}
                                    {m.startTime}–{m.endTime}
                                  </span>
                                  {kind === "vacant" ? (
                                    <span className="w-full truncate italic">{BOOKING_KIND_LABEL.vacant}</span>
                                  ) : (
                                    <>
                                      <span className="w-full truncate">
                                        {m.studentName}
                                        {m.className && ` · ${m.className}`}
                                      </span>
                                      {phone && <span className="w-full truncate text-[10px] font-normal opacity-80">{phone}</span>}
                                      {/* The same kind line the day grid prints
                                          under the name (ScheduleGrid's
                                          EventContent). The tint alone is easy to
                                          misread at this size, so a lịch cố định
                                          says so in both views rather than only
                                          in one. */}
                                      <span className="w-full truncate text-[10px] font-normal opacity-70">{BOOKING_KIND_LABEL[kind]}</span>
                                    </>
                                  )}
                                  {/* Week view only: the day view already has a
                                      desk column, this one doesn't, so without
                                      this line the week says who is booked but
                                      never which chỗ. */}
                                  {desk && <span className="w-full truncate text-[10px] font-semibold">{desk.label}</span>}
                                </Chip>
                              )
                            })}
                            {starting.length === 0 && (
                              <span className="flex h-full min-h-6 w-full items-center justify-center text-[10px] text-muted-foreground">
                                {totalDesks === 0 ? "Không có chỗ" : free > 0 ? `Còn ${free} chỗ` : "Hết chỗ"}
                              </span>
                            )}
                          </div>
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
