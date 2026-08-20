import { TIME_SLOTS } from "@/lib/time-slots"

export type OccupancyRow = { deskId: string; date: string; totalSlots: number; bookedSlots: number; rate: number }

function isoDayOfWeek(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00Z`)
  return ((date.getUTCDay() + 6) % 7) + 1
}

export function computeOccupancy(
  desks: { id: string; label: string }[],
  registrations: { deskId: string; date: string; startTime: string; endTime: string }[],
  locks: { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }[],
  dates: string[]
): OccupancyRow[] {
  return desks.flatMap((desk) =>
    dates.map((date) => {
      const isoDow = isoDayOfWeek(date)
      const availableSlots = TIME_SLOTS.filter(
        (slot) =>
          !locks.some(
            (l) => (l.deskId === desk.id || l.deskId === null) && l.dayOfWeek === isoDow && l.startTime < slot.end && l.endTime > slot.start
          )
      )
      // Count SLOTS covered, not registration rows. Since Task 8b's react-big-calendar
      // rewrite a single registration can span a drag-selected multi-slot range
      // (e.g. 08:00-10:00 = 4 slots in one row), so counting rows silently
      // under-reported occupancy. Same half-open [start, end) overlap check used by
      // ScheduleGrid's isLocked and the booking RPCs.
      const booked = availableSlots.filter((slot) =>
        registrations.some(
          (r) => r.deskId === desk.id && r.date === date && r.startTime < slot.end && r.endTime > slot.start
        )
      ).length
      return {
        deskId: desk.id,
        date,
        totalSlots: availableSlots.length,
        bookedSlots: booked,
        rate: availableSlots.length === 0 ? 0 : booked / availableSlots.length,
      }
    })
  )
}

export type MissingStudent = { studentId: string; studentName: string }

function addDaysToDateStr(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function findMissingRegistrations(
  recurring: { studentId: string; studentName: string; dayOfWeek: number; active: boolean }[],
  registrations: { studentId: string; date: string }[],
  weekMonday: string
): MissingStudent[] {
  return recurring
    .filter((r) => r.active)
    .filter((r) => {
      const expectedDate = addDaysToDateStr(weekMonday, r.dayOfWeek - 1)
      return !registrations.some((reg) => reg.studentId === r.studentId && reg.date === expectedDate)
    })
    .map((r) => ({ studentId: r.studentId, studentName: r.studentName }))
}

export type FrequencyRow = { studentId: string; studentName: string; count: number }

export function computeFrequencyRanking(
  registrations: { studentId: string; studentName: string; date: string; status: "active" | "cancelled" }[],
  sinceDate: string
): FrequencyRow[] {
  const counts = new Map<string, FrequencyRow>()
  for (const r of registrations) {
    if (r.status !== "active" || r.date < sinceDate) continue
    const existing = counts.get(r.studentId)
    if (existing) existing.count += 1
    else counts.set(r.studentId, { studentId: r.studentId, studentName: r.studentName, count: 1 })
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}
