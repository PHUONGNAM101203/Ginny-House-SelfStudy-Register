/**
 * Absolute-number statistics for the dashboard. Gin Anh: "cho nó hiển thị số
 * liệu đừng là %" — a percentage hides how busy the centre actually is, and
 * an occupancy rate of 8% told nobody whether that was 2 buổi or 200.
 *
 * Pure and side-effect free so every figure on the dashboard can be tested
 * without a database.
 */

export type StatRegistration = {
  studentId: string | null
  studentName: string | null
  branchId: string
  deskId: string
  date: string
  startTime: string
  endTime: string
  status: "active" | "cancelled"
  recurringRegistrationId: string | null
}

export type Counted = { label: string; count: number }

/** How many bookings land on each day of the given week, in order. */
export function countByDate(registrations: StatRegistration[], weekDates: string[]): Counted[] {
  const counts = new Map(weekDates.map((d) => [d, 0]))
  for (const r of registrations) {
    if (r.status !== "active") continue
    if (!counts.has(r.date)) continue
    counts.set(r.date, (counts.get(r.date) ?? 0) + 1)
  }
  return weekDates.map((date) => ({ label: date, count: counts.get(date) ?? 0 }))
}

function tally<T>(items: T[], key: (item: T) => string | null): Counted[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    const k = key(item)
    if (!k) continue
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    // Ties broken by label so the order is stable between renders rather than
    // depending on Map insertion order.
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

export function countByBranch(
  registrations: StatRegistration[],
  branchNames: Map<string, string>
): Counted[] {
  return tally(
    registrations.filter((r) => r.status === "active"),
    (r) => branchNames.get(r.branchId) ?? null
  )
}

export function countByDesk(
  registrations: StatRegistration[],
  deskLabels: Map<string, string>,
  limit = 8
): Counted[] {
  return tally(
    registrations.filter((r) => r.status === "active"),
    (r) => deskLabels.get(r.deskId) ?? null
  ).slice(0, limit)
}

/** Busiest starting times — which giờ the centre actually fills up. */
export function countByStartTime(registrations: StatRegistration[], limit = 8): Counted[] {
  return tally(
    registrations.filter((r) => r.status === "active"),
    (r) => r.startTime
  ).slice(0, limit)
}

export type KindCounts = {
  normal: number
  recurring: number
  vacant: number
  cancelled: number
}

/** The same four card types the calendar draws, counted. */
export function countByKind(registrations: StatRegistration[]): KindCounts {
  const counts: KindCounts = { normal: 0, recurring: 0, vacant: 0, cancelled: 0 }
  for (const r of registrations) {
    if (r.status === "cancelled") counts.cancelled += 1
    else if (r.studentId === null) counts.vacant += 1
    else if (r.recurringRegistrationId) counts.recurring += 1
    else counts.normal += 1
  }
  return counts
}

/** Distinct students who actually hold a booking in the given set. */
export function countDistinctStudents(registrations: StatRegistration[]): number {
  const ids = new Set<string>()
  for (const r of registrations) {
    if (r.status !== "active" || !r.studentId) continue
    ids.add(r.studentId)
  }
  return ids.size
}

/**
 * Total hours booked. Slots are half-hour aligned everywhere in this app, so
 * minute arithmetic on "HH:MM" is exact — no date parsing needed.
 */
export function totalBookedHours(registrations: StatRegistration[]): number {
  let minutes = 0
  for (const r of registrations) {
    if (r.status !== "active") continue
    const [sh, sm] = r.startTime.split(":").map(Number)
    const [eh, em] = r.endTime.split(":").map(Number)
    minutes += eh * 60 + em - (sh * 60 + sm)
  }
  return Math.round((minutes / 60) * 10) / 10
}
