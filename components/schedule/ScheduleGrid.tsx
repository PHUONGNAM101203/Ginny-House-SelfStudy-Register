"use client"

import { format } from "date-fns"
import { TIME_SLOTS } from "@/lib/time-slots"
import { getWeekDates } from "@/lib/week"
import { SlotCell } from "@/components/schedule/SlotCell"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export type SlotClickPayload = {
  desk: Desk
  date: string
  startTime: string
  endTime: string
  registration?: RegistrationRow
}

export function ScheduleGrid({
  desks, monday, registrations, locks, onSlotClick,
}: {
  desks: Desk[]; monday: Date; registrations: RegistrationRow[]; locks: SlotLock[]
  onSlotClick: (payload: SlotClickPayload) => void
}) {
  const dates = getWeekDates(monday)

  function findRegistration(deskId: string, date: string, startTime: string) {
    return registrations.find((r) => r.deskId === deskId && r.date === date && r.startTime === startTime)
  }

  function isLocked(deskId: string, isoDow: number, startTime: string, endTime: string) {
    return locks.some(
      (l) => (l.deskId === deskId || l.deskId === null) && l.dayOfWeek === isoDow && l.startTime < endTime && l.endTime > startTime
    )
  }

  return (
    <div className="overflow-x-auto">
      {dates.map((date) => {
        const dateStr = format(date, "yyyy-MM-dd")
        const isoDow = ((date.getDay() + 6) % 7) + 1
        return (
          <div key={dateStr} className="mb-6">
            <h3 className="mb-2 text-sm font-medium">{format(date, "EEEE dd/MM")}</h3>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${desks.length}, minmax(60px, 1fr))` }}>
              {desks.map((desk) => (
                <div key={desk.id} className="flex flex-col gap-1">
                  <span className="text-center text-xs text-muted-foreground">{desk.label}</span>
                  {TIME_SLOTS.map((slot) => {
                    const registration = findRegistration(desk.id, dateStr, slot.start)
                    const locked = !registration && isLocked(desk.id, isoDow, slot.start, slot.end)
                    const state = registration ? "booked" : locked ? "locked" : "free"
                    return (
                      <SlotCell
                        key={slot.start}
                        slot={slot}
                        state={state}
                        registration={registration}
                        onClick={() =>
                          onSlotClick({ desk, date: dateStr, startTime: slot.start, endTime: slot.end, registration })
                        }
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
