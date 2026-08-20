import { describe, it, expect } from "vitest"
import { computeOccupancy, findMissingRegistrations, computeFrequencyRanking } from "@/lib/dashboard"

describe("computeOccupancy", () => {
  it("computes booked/total/locked per desk-day and rolls up a rate", () => {
    const desks = [{ id: "d1", label: "Chỗ 1" }]
    const registrations = [{ deskId: "d1", date: "2026-08-17", startTime: "08:00", endTime: "08:30" }]
    const locks: { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }[] = []
    const result = computeOccupancy(desks, registrations, locks, ["2026-08-17"])
    expect(result[0].totalSlots).toBe(24)
    expect(result[0].bookedSlots).toBe(1)
    expect(result[0].rate).toBeCloseTo(1 / 24)
  })

  it("excludes locked slots from the available total", () => {
    const desks = [{ id: "d1", label: "Chỗ 1" }]
    const locks = [{ deskId: "d1", dayOfWeek: 1, startTime: "08:00", endTime: "22:00" }]
    const result = computeOccupancy(desks, [], locks, ["2026-08-17"])
    expect(result[0].totalSlots).toBe(0)
    expect(result[0].rate).toBe(0)
  })
})

describe("findMissingRegistrations", () => {
  it("flags a student with an active recurring rule but no registration this week", () => {
    const recurring = [{ studentId: "s1", studentName: "A", dayOfWeek: 1, active: true }]
    const registrations: { studentId: string; date: string }[] = []
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(1)
    expect(missing[0].studentName).toBe("A")
  })

  it("does not flag a student who already has a registration this week", () => {
    const recurring = [{ studentId: "s1", studentName: "A", dayOfWeek: 1, active: true }]
    const registrations = [{ studentId: "s1", date: "2026-08-17" }]
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(0)
  })

  it("does not flag inactive recurring rules", () => {
    const recurring = [{ studentId: "s1", studentName: "A", dayOfWeek: 1, active: false }]
    const registrations: { studentId: string; date: string }[] = []
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(0)
  })

  it("flags a student when registration is on a different day than the rule expects", () => {
    // weekMonday: "2026-08-17" is Monday
    // dayOfWeek: 3 means Wednesday, so expected date is 2026-08-19
    // but student registered on 2026-08-17 (Monday instead)
    const recurring = [{ studentId: "s1", studentName: "A", dayOfWeek: 3, active: true }]
    const registrations = [{ studentId: "s1", date: "2026-08-17" }]
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(1)
    expect(missing[0].studentName).toBe("A")
  })

  it("does not flag a student when registration is on the exact expected day", () => {
    // weekMonday: "2026-08-17" is Monday
    // dayOfWeek: 3 means Wednesday, so expected date is 2026-08-19
    const recurring = [{ studentId: "s1", studentName: "A", dayOfWeek: 3, active: true }]
    const registrations = [{ studentId: "s1", date: "2026-08-19" }]
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(0)
  })
})

describe("computeFrequencyRanking", () => {
  it("counts active sessions per student since a date, descending", () => {
    const registrations = [
      { studentId: "s1", studentName: "A", date: "2026-08-17", status: "active" as const },
      { studentId: "s1", studentName: "A", date: "2026-08-18", status: "active" as const },
      { studentId: "s2", studentName: "B", date: "2026-08-18", status: "active" as const },
      { studentId: "s1", studentName: "A", date: "2026-08-10", status: "active" as const },
    ]
    const ranking = computeFrequencyRanking(registrations, "2026-08-15")
    expect(ranking[0]).toEqual({ studentId: "s1", studentName: "A", count: 2 })
    expect(ranking[1]).toEqual({ studentId: "s2", studentName: "B", count: 1 })
  })

  it("excludes cancelled registrations from the count", () => {
    const registrations = [
      { studentId: "s1", studentName: "A", date: "2026-08-17", status: "active" as const },
      { studentId: "s1", studentName: "A", date: "2026-08-18", status: "cancelled" as const },
      { studentId: "s2", studentName: "B", date: "2026-08-18", status: "active" as const },
    ]
    const ranking = computeFrequencyRanking(registrations, "2026-08-15")
    expect(ranking[0]).toEqual({ studentId: "s1", studentName: "A", count: 1 })
    expect(ranking[1]).toEqual({ studentId: "s2", studentName: "B", count: 1 })
  })
})
