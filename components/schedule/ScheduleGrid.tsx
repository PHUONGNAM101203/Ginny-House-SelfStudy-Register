"use client"

import { Calendar, dateFnsLocalizer, type SlotInfo } from "react-big-calendar"
import { format, startOfWeek, getDay, addMinutes, setHours, setMinutes } from "date-fns"
import { vi } from "date-fns/locale"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"
import { parseYmd } from "@/lib/vn-date"
import "react-big-calendar/lib/css/react-big-calendar.css"

export type SlotClickPayload = {
  desk: Desk
  date: string
  startTime: string
  endTime: string
  registration?: RegistrationRow
}

type BookingEvent = {
  id: string
  title: string
  start: Date
  end: Date
  resourceId: string
  registration: RegistrationRow
}

/**
 * Stacked name/class/phone, same staff-only-phone treatment as
 * WeekOverview's merged card — `phoneByStudentId` is only ever populated on
 * the internal page (see app/noi-bo/lich/page.tsx), never the guest-facing
 * one, so this silently degrades to name+class when undefined.
 */
function EventContent({ event, phoneByStudentId }: { event: BookingEvent; phoneByStudentId?: Map<string, string> }) {
  const phone = phoneByStudentId?.get(event.registration.studentId)
  return (
    <div className="flex flex-col leading-tight">
      <span className="truncate">
        {event.registration.studentName}
        {event.registration.className && ` · ${event.registration.className}`}
      </span>
      {phone && <span className="truncate font-normal opacity-80">{phone}</span>}
      <span className="truncate font-normal opacity-70">
        {event.registration.recurringRegistrationId ? "Lịch cố định" : "Lịch bình thường"}
      </span>
    </div>
  )
}

// RBC's dateFnsLocalizer only ever calls `format`, `startOfWeek`, and `getDay`
// internally (verified against the installed package) — `parse` is commonly
// imported alongside by convention but is unused here, so it's omitted.
const localizer = dateFnsLocalizer({
  format,
  startOfWeek,
  getDay,
  locales: { vi },
})

// Minimal message overrides: `toolbar={false}` removes RBC's own nav bar (day
// navigation is DateNavigator, rendered outside this component), so
// previous/next/today never render. Only translate strings that can actually
// surface in a resource day view.
const messages = {
  noEventsInRange: "Không có lịch đặt nào",
  showMore: (total: number) => `+${total} nữa`,
}

// RBC has no way to render one day as a single time axis with a gap in the
// middle, so each day is two stacked instances — one per opening block.
// start/end are the real bookable business hours (used for the header text,
// the events filter, and outOfHours) — the grid's rendered *range* is one
// slot wider than this (see boundaryRowMax() below), never these values
// directly.
const BLOCKS = [
  { key: "morning", label: "Buổi sáng", start: "08:00", end: "12:00" },
  { key: "afternoon", label: "Buổi chiều – tối", start: "14:00", end: "22:00" },
] as const

function timeOnDate(date: Date, hm: string): Date {
  const [h, m] = hm.split(":").map(Number)
  return setMinutes(setHours(date, h), m)
}

const SLOT_MINUTES = 30

function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number)
  return h * 60 + m
}

/**
 * How many 30-minute rows RBC renders for a block, including the trailing
 * boundary row (see boundaryRowMax()).
 *
 * A block's real bookable range is a half-open interval: 08:00–12:00 is 8
 * bookable rows whose last one *starts* at 11:30. RBC only ever labels a row
 * by its start time (verified against the installed package's TimeGutter.js:
 * it explicitly renders `null` for every sub-slot but the first in a group),
 * so a grid that stopped exactly at the last bookable row read as if it
 * stopped at 11:30 rather than reaching the 12:00 the section header states.
 * The fix used here is the one RBC actually supports: render one more real,
 * native row — at exactly 12:00 — instead of inventing a label outside the
 * grid. That row is locked (see makeSlotPropGetter/handleSelectSlot below),
 * so it's visually and functionally a closing tick, not a bookable half hour.
 *
 * This count is what sizes the container (via the `--rbc-slot-count` custom
 * property read by the `.schedule-grid-calendar .rbc-calendar` height rule in
 * app/globals.css), so the container is exactly as tall as its content by
 * construction and cannot drift out of sync the way two hand-tuned pixel
 * heights once did.
 */
function slotCount(block: { start: string; end: string }): number {
  return (minutesOf(block.end) - minutesOf(block.start)) / SLOT_MINUTES + 1
}

/** The Date RBC's `max` prop needs to render the boundary row — one slot past the block's real end. */
function boundaryRowMax(date: Date, block: { end: string }): Date {
  return addMinutes(timeOnDate(date, block.end), SLOT_MINUTES)
}

// RBC resolves which slot a click landed on from raw pixel coordinates, and that
// computation is not pixel-stable: the same click on the "08:00" cell was observed
// (verified against the `registrations` table, not just the UI) to sometimes resolve
// to 08:00 and sometimes to the adjacent 08:30. Snapping both ends onto the real
// 30-minute grid before the payload is built guarantees the booked range always
// matches a slot that is actually rendered, whatever sub-slot imprecision RBC hands us.
function floorToSlot(date: Date): Date {
  const minutes = date.getHours() * 60 + date.getMinutes()
  const floored = Math.floor(minutes / SLOT_MINUTES) * SLOT_MINUTES
  return setMinutes(setHours(date, Math.floor(floored / 60)), floored % 60)
}

function ceilToSlot(date: Date): Date {
  const minutes = date.getHours() * 60 + date.getMinutes()
  const ceiled = Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES
  return setMinutes(setHours(date, Math.floor(ceiled / 60)), ceiled % 60)
}

/**
 * One day's desk-booking grid: desks are columns, 30-minute slots are rows.
 *
 * Renders a single `date` rather than the whole week (the week is still what
 * `getScheduleData` fetches — the caller passes the week's rows and this
 * component slices out the requested day). Day navigation lives in
 * DateNavigator, above and outside this component's scroll container.
 */
export function ScheduleGrid({
  desks, date: dateStr, registrations, locks, onSlotClick, phoneByStudentId,
}: {
  desks: Desk[]
  /** "yyyy-MM-dd" — a calendar day, not an instant (see lib/vn-date.ts). */
  date: string
  registrations: RegistrationRow[]; locks: SlotLock[]
  onSlotClick: (payload: SlotClickPayload) => void
  /** Staff-only — omitted entirely on the guest-facing page (see ScheduleGridClient). */
  phoneByStudentId?: Map<string, string>
}) {
  // Rebuilt as local midnight here rather than handed over as a Date: a Date is
  // an instant, so it would render as the previous calendar day in any browser
  // west of the server's Asia/Ho_Chi_Minh (see lib/vn-date.ts).
  const date = parseYmd(dateStr)
  const isoDow = ((date.getDay() + 6) % 7) + 1

  function findRegistration(deskId: string, startTime: string) {
    return registrations.find((r) => r.deskId === deskId && r.date === dateStr && r.startTime === startTime)
  }

  function isLocked(deskId: string, startTime: string, endTime: string) {
    return locks.some(
      (l) => (l.deskId === deskId || l.deskId === null) && l.dayOfWeek === isoDow && l.startTime < endTime && l.endTime > startTime
    )
  }

  const events: BookingEvent[] = registrations
    .filter((r) => r.date === dateStr)
    .map((r) => ({
      id: r.id,
      // Gin Anh: the chip needs to name which class booked it, not just who.
      title: r.className ? `${r.studentName} · ${r.className}` : r.studentName,
      start: timeOnDate(date, r.startTime),
      end: timeOnDate(date, r.endTime),
      resourceId: r.deskId,
      registration: r,
    }))

  // A registration whose start falls in neither block (the 12:00-14:00 gap, or
  // before 08:00 / at-or-after 22:00) matches no Calendar instance and would
  // otherwise render nowhere at all — silently invisible, while still holding
  // its slot against anyone trying to book over it. Nothing in the schema
  // forbids such a row, so surface them as text instead of dropping them.
  const outOfHours = registrations.filter(
    (r) => r.date === dateStr && !BLOCKS.some((b) => r.startTime >= b.start && r.startTime < b.end)
  )

  function handleSelectSlot(slotInfo: SlotInfo) {
    if (slotInfo.resourceId == null) return
    const deskId = String(slotInfo.resourceId)
    const desk = desks.find((d) => d.id === deskId)
    if (!desk) return
    // Snap onto the real 30-minute grid (see floorToSlot/ceilToSlot above).
    // ceil is used for the end rather than a forced start+30 so a multi-slot
    // drag selection still books its whole range; the max() keeps a
    // degenerate/sub-slot selection from collapsing to a zero-length range.
    const snappedStart = floorToSlot(slotInfo.start)
    const snappedEnd = new Date(
      Math.max(ceilToSlot(slotInfo.end).getTime(), addMinutes(snappedStart, SLOT_MINUTES).getTime())
    )
    const startTime = format(snappedStart, "HH:mm")
    const endTime = format(snappedEnd, "HH:mm")
    // Each block's grid now renders one extra row at exactly its end time
    // (see slotCount()/boundaryRowMax()) purely so that time gets a real,
    // native label — it was never a bookable half hour, so a click that
    // resolves to it (or to anything outside every block's real range) is
    // rejected here the same way isLocked() rejects an admin-locked slot.
    if (!BLOCKS.some((b) => startTime >= b.start && startTime < b.end)) return
    // Enforcement lives here, not in slotPropGetter — the CSS class RBC
    // renders for a locked slot is visual only, it does not stop clicks.
    if (isLocked(deskId, startTime, endTime)) return
    onSlotClick({ desk, date: dateStr, startTime, endTime, registration: findRegistration(deskId, startTime) })
  }

  function handleSelectEvent(event: BookingEvent) {
    const desk = desks.find((d) => d.id === event.resourceId)
    if (!desk) return
    onSlotClick({
      desk,
      date: dateStr,
      startTime: event.registration.startTime,
      endTime: event.registration.endTime,
      registration: event.registration,
    })
  }

  // Scoped per block (not shared) so the boundary-row check below knows which
  // block's end time it's rendering — reused as-is by both stacked instances
  // otherwise, it would only ever recognize one block's boundary.
  function makeSlotPropGetter(blockEnd: string) {
    return function slotPropGetter(slotDate: Date, resourceId?: string | number) {
      if (resourceId == null) return {}
      const deskId = String(resourceId)
      const startTime = format(slotDate, "HH:mm")
      const endTime = format(addMinutes(slotDate, SLOT_MINUTES), "HH:mm")
      // `slot-${deskId}-${startTime}` is the stable hook tests/e2e/booking.spec.ts
      // clicks by — RBC's slotPropGetter return type has no data-* support, so a
      // className stands in for a data-testid.
      const baseClassName = `slot-${deskId}-${startTime}`
      // The boundary row (see slotCount()) is always blocked from booking —
      // handleSelectSlot rejects it regardless of this className — but it
      // renders with no special styling, matching every real bookable row's
      // color exactly. It exists only to give block.end a real, native
      // label; visually singling it out as "locked" would misrepresent it
      // as a slot that's merely unavailable today rather than one that was
      // never bookable.
      if (startTime !== blockEnd && isLocked(deskId, startTime, endTime)) {
        return { className: `${baseClassName} rbc-slot-locked` }
      }
      return { className: baseClassName }
    }
  }

  if (desks.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        Cơ sở này chưa có chỗ ngồi nào đang mở.
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {outOfHours.length > 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Ngoài khung giờ mở cửa:{" "}
          {outOfHours
            .map((r) => `${desks.find((d) => d.id === r.deskId)?.label ?? "?"} ${r.startTime}–${r.endTime} (${r.studentName})`)
            .join(" · ")}
        </p>
      )}
      {/* min-w-0: this div is a flex item of a flex-col parent (see app/page.tsx's
          outer wrapper comment). Flex items default to min-width:auto and refuse
          to shrink below their content's intrinsic width, so without it the
          desk-column grid pushes the *page* into horizontal scroll instead of
          scrolling inside this container. */}
      <div className="min-w-0 overflow-x-auto rounded-lg border border-border">
        <div className="schedule-grid-calendar min-w-fit">
          {BLOCKS.map((block) => (
            <section
              key={block.key}
              aria-label={`${block.label} — ${format(date, "dd/MM/yyyy")}`}
              // The block's row count, not a pixel height: app/globals.css
              // multiplies it by the same --rbc-slot-row that sizes an actual
              // row, so the container is exactly as tall as its content by
              // construction and cannot drift out of sync the way the two
              // hardcoded heights did. See slotCount() above.
              style={{ "--rbc-slot-count": slotCount(block) } as React.CSSProperties}
            >
              {/* sticky left-0 w-fit: the block label stays readable while the
                  desk columns scroll sideways underneath it. */}
              <h3 className="sticky left-0 w-fit px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {block.label} · {block.start}–{block.end}
              </h3>
              <Calendar<BookingEvent, Desk>
                localizer={localizer}
                culture="vi"
                messages={messages}
                // Each stacked instance only gets events that start inside its own
                // [min, max) window — without this filter, a morning booking passed
                // to the afternoon instance (or vice versa) falls outside that
                // instance's visible range and RBC bumps it into the header/all-day
                // row instead of hiding it, which reads as a stray duplicate chip.
                events={events.filter((e) => {
                  const t = format(e.start, "HH:mm")
                  return t >= block.start && t < block.end
                })}
                resources={desks}
                resourceIdAccessor="id"
                resourceTitleAccessor="label"
                defaultDate={date}
                date={date}
                view="day"
                views={["day"]}
                // RBC's own toolbar stays off: navigation is DateNavigator, which
                // sits outside this horizontally scrolling container so it never
                // scrolls off screen on a phone (and would otherwise have to
                // render twice, once per stacked instance).
                toolbar={false}
                selectable
                step={30}
                timeslots={1}
                min={timeOnDate(date, block.start)}
                // One slot past the block's real end — see slotCount() and
                // boundaryRowMax() for why this renders a real, native,
                // locked row at exactly block.end instead of stopping at the
                // last bookable row's own start label.
                max={boundaryRowMax(date, block)}
                // Pin RBC's mount-time auto-scroll to the top of our own range.
                // RBC defaults scrollToTime to ~the current time of day, so in
                // componentDidMount it scrolled .rbc-time-content down by ~56px
                // (1.4 slots) *after* first paint. Two consequences: the first
                // slot row started out hidden under the header, and a click that
                // landed in that post-paint window was resolved by RBC against
                // geometry that had shifted under the pointer — which is the real
                // cause of the "booked the adjacent slot" flakiness recorded in
                // tests/e2e/booking.spec.ts. Our min/max already frame exactly the
                // range we want visible, so there is nothing to scroll to.
                scrollToTime={timeOnDate(date, block.start)}
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                slotPropGetter={makeSlotPropGetter(block.end)}
                components={{ event: (props) => <EventContent {...props} phoneByStudentId={phoneByStudentId} /> }}
              />
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
