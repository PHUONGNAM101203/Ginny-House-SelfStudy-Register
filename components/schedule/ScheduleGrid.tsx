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
const BLOCKS = [
  { key: "morning", label: "Buổi sáng", start: "08:00", end: "12:00", height: 340 },
  { key: "afternoon", label: "Buổi chiều – tối", start: "14:00", end: "22:00", height: 620 },
] as const

function timeOnDate(date: Date, hm: string): Date {
  const [h, m] = hm.split(":").map(Number)
  return setMinutes(setHours(date, h), m)
}

const SLOT_MINUTES = 30

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
  desks, date: dateStr, registrations, locks, onSlotClick,
}: {
  desks: Desk[]
  /** "yyyy-MM-dd" — a calendar day, not an instant (see lib/vn-date.ts). */
  date: string
  registrations: RegistrationRow[]; locks: SlotLock[]
  onSlotClick: (payload: SlotClickPayload) => void
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
      title: r.studentName,
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

  function slotPropGetter(slotDate: Date, resourceId?: string | number) {
    if (resourceId == null) return {}
    const deskId = String(resourceId)
    const startTime = format(slotDate, "HH:mm")
    const endTime = format(addMinutes(slotDate, SLOT_MINUTES), "HH:mm")
    // `slot-${deskId}-${startTime}` is the stable hook tests/e2e/booking.spec.ts
    // clicks by — RBC's slotPropGetter return type has no data-* support, so a
    // className stands in for a data-testid.
    const baseClassName = `slot-${deskId}-${startTime}`
    if (isLocked(deskId, startTime, endTime)) {
      return { className: `${baseClassName} rbc-slot-locked` }
    }
    return { className: baseClassName }
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
            <section key={block.key} aria-label={`${block.label} — ${format(date, "dd/MM/yyyy")}`}>
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
                max={timeOnDate(date, block.end)}
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
                slotPropGetter={slotPropGetter}
                style={{ height: block.height }}
              />
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
