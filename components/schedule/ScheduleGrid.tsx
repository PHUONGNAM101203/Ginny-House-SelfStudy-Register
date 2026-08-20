"use client"

import { useMemo } from "react"
import { Calendar, dateFnsLocalizer, type SlotInfo } from "react-big-calendar"
import { format, startOfWeek, getDay, addMinutes, setHours, setMinutes } from "date-fns"
import { vi } from "date-fns/locale"
import { getWeekDates } from "@/lib/week"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"
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

// Minimal message overrides: `toolbar={false}` removes RBC's own nav bar (this
// app already has BranchTabs/WeekPicker), so previous/next/today never render.
// Only translate strings that can actually surface in a resource day view.
const messages = {
  allDay: "Cả ngày",
  noEventsInRange: "Không có lịch đặt nào",
  showMore: (total: number) => `+${total} nữa`,
}

const MORNING = { start: "08:00", end: "12:00" }
const AFTERNOON = { start: "14:00", end: "22:00" }

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

export function ScheduleGrid({
  desks, monday, registrations, locks, onSlotClick,
}: {
  desks: Desk[]; monday: Date; registrations: RegistrationRow[]; locks: SlotLock[]
  onSlotClick: (payload: SlotClickPayload) => void
}) {
  const dates = useMemo(() => getWeekDates(monday), [monday])

  function findRegistration(deskId: string, date: string, startTime: string) {
    return registrations.find((r) => r.deskId === deskId && r.date === date && r.startTime === startTime)
  }

  function isLocked(deskId: string, isoDow: number, startTime: string, endTime: string) {
    return locks.some(
      (l) => (l.deskId === deskId || l.deskId === null) && l.dayOfWeek === isoDow && l.startTime < endTime && l.endTime > startTime
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {dates.map((date) => {
        const dateStr = format(date, "yyyy-MM-dd")
        const isoDow = ((date.getDay() + 6) % 7) + 1

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
          if (isLocked(deskId, isoDow, startTime, endTime)) return
          const registration = findRegistration(deskId, dateStr, startTime)
          onSlotClick({ desk, date: dateStr, startTime, endTime, registration })
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
          const endTime = format(addMinutes(slotDate, 30), "HH:mm")
          // `slot-${deskId}-${startTime}` is a stable hook for the future E2E
          // test task — RBC's slotPropGetter return type has no data-* support,
          // so a className is used in place of the old SlotCell's data-testid.
          const baseClassName = `slot-${deskId}-${startTime}`
          if (isLocked(deskId, isoDow, startTime, endTime)) {
            return { className: `${baseClassName} rbc-slot-locked` }
          }
          return { className: baseClassName }
        }

        return (
          // min-w-0: this div is a flex item of the flex-col container just
          // below (a fresh gotcha per day-instance, same root cause as
          // app/page.tsx's outer wrapper — see the comment there). Without
          // it, this per-day overflow-x-auto div refuses to shrink below the
          // calendar's intrinsic content width, so the horizontal scroll
          // leaks out to the page instead of staying contained here.
          <div key={dateStr} className="min-w-0 overflow-x-auto">
            <h3 className="mb-2 text-sm font-medium text-foreground">{format(date, "EEEE dd/MM", { locale: vi })}</h3>
            <div className="schedule-grid-calendar min-w-fit rounded-md border border-border">
              {[MORNING, AFTERNOON].map((range) => (
                <Calendar<BookingEvent, Desk>
                  key={range.start}
                  localizer={localizer}
                  culture="vi"
                  messages={messages}
                  // Each stacked instance only gets events that start inside
                  // its own [min, max) window — without this filter, a
                  // morning booking passed to the afternoon instance (or vice
                  // versa) falls outside that instance's visible range and
                  // RBC bumps it into the header/all-day row instead of
                  // hiding it, which reads as a stray duplicate chip.
                  events={events.filter((e) => {
                    const t = format(e.start, "HH:mm")
                    return t >= range.start && t < range.end
                  })}
                  resources={desks}
                  resourceIdAccessor="id"
                  resourceTitleAccessor="label"
                  defaultDate={date}
                  date={date}
                  view="day"
                  views={["day"]}
                  toolbar={false}
                  selectable
                  step={30}
                  timeslots={1}
                  min={timeOnDate(date, range.start)}
                  max={timeOnDate(date, range.end)}
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
                  scrollToTime={timeOnDate(date, range.start)}
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  slotPropGetter={slotPropGetter}
                  style={{ height: range === MORNING ? 340 : 620 }}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
