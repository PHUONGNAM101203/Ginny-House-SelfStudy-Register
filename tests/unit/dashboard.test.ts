import { describe, it, expect } from "vitest"
import { findMissingRegistrations, computeFrequencyRanking } from "@/lib/dashboard"

describe("findMissingRegistrations", () => {
  it("flags a student with an active recurring rule but no registration this week", () => {
    const recurring = [{ studentId: "s1", studentName: "A", phone: "0900000001", className: "10A1", dayOfWeek: 1, active: true }]
    const registrations: { studentId: string; date: string }[] = []
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(1)
    expect(missing[0].studentName).toBe("A")
  })

  it("does not flag a student who already has a registration this week", () => {
    const recurring = [{ studentId: "s1", studentName: "A", phone: "0900000001", className: "10A1", dayOfWeek: 1, active: true }]
    const registrations = [{ studentId: "s1", date: "2026-08-17" }]
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(0)
  })

  it("does not flag inactive recurring rules", () => {
    const recurring = [{ studentId: "s1", studentName: "A", phone: "0900000001", className: "10A1", dayOfWeek: 1, active: false }]
    const registrations: { studentId: string; date: string }[] = []
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(0)
  })

  it("flags a student when registration is on a different day than the rule expects", () => {
    // weekMonday: "2026-08-17" is Monday
    // dayOfWeek: 3 means Wednesday, so expected date is 2026-08-19
    // but student registered on 2026-08-17 (Monday instead)
    const recurring = [{ studentId: "s1", studentName: "A", phone: "0900000001", className: "10A1", dayOfWeek: 3, active: true }]
    const registrations = [{ studentId: "s1", date: "2026-08-17" }]
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(1)
    expect(missing[0].studentName).toBe("A")
  })

  it("does not flag a student when registration is on the exact expected day", () => {
    // weekMonday: "2026-08-17" is Monday
    // dayOfWeek: 3 means Wednesday, so expected date is 2026-08-19
    const recurring = [{ studentId: "s1", studentName: "A", phone: "0900000001", className: "10A1", dayOfWeek: 3, active: true }]
    const registrations = [{ studentId: "s1", date: "2026-08-19" }]
    const missing = findMissingRegistrations(recurring, registrations, "2026-08-17")
    expect(missing).toHaveLength(0)
  })

  it("carries phone and className through so the dashboard panel can display them", () => {
    const recurring = [{ studentId: "s1", studentName: "A", phone: "0911111111", className: "12C3", dayOfWeek: 1, active: true }]
    const missing = findMissingRegistrations(recurring, [], "2026-08-17")
    expect(missing[0]).toEqual({ studentId: "s1", studentName: "A", phone: "0911111111", className: "12C3" })
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
