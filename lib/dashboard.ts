import { TIME_SLOTS } from "@/lib/time-slots"

export type MissingStudent = { studentId: string; studentName: string; phone: string; className: string | null }

function addDaysToDateStr(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function findMissingRegistrations(
  recurring: { studentId: string; studentName: string; phone: string; className: string | null; dayOfWeek: number; active: boolean }[],
  registrations: { studentId: string; date: string }[],
  weekMonday: string
): MissingStudent[] {
  return recurring
    .filter((r) => r.active)
    .filter((r) => {
      const expectedDate = addDaysToDateStr(weekMonday, r.dayOfWeek - 1)
      return !registrations.some((reg) => reg.studentId === r.studentId && reg.date === expectedDate)
    })
    .map((r) => ({ studentId: r.studentId, studentName: r.studentName, phone: r.phone, className: r.className }))
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
