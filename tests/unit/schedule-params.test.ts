import { describe, it, expect } from "vitest"
import { format, addYears, addDays } from "date-fns"
import { resolveScheduleDates } from "@/lib/schedule-params"
import { getMondayOfWeek } from "@/lib/week"
import { parseYmd, vietnamToday } from "@/lib/vn-date"

const ymd = (d: Date) => format(d, "yyyy-MM-dd")
const today = vietnamToday()

describe("resolveScheduleDates", () => {
  it("uses the day param and derives that day's Monday", () => {
    // 2026-08-20 is a Thursday; its Monday is 2026-08-17. Both are inside the
    // ±2y window relative to the suite's "today".
    const { selectedDate, monday } = resolveScheduleDates("2026-08-20", undefined)
    expect(selectedDate).toBe("2026-08-20")
    expect(ymd(monday)).toBe("2026-08-17")
  })

  it("lets the day param win over a disagreeing week param", () => {
    const { selectedDate, monday } = resolveScheduleDates("2026-09-02", "2026-08-17")
    expect(selectedDate).toBe("2026-09-02")
    expect(ymd(monday)).toBe("2026-08-31")
  })

  it("falls back to the week's Monday when only week is given (legacy links)", () => {
    const { selectedDate, monday } = resolveScheduleDates(undefined, "2026-08-19")
    expect(selectedDate).toBe("2026-08-17")
    expect(ymd(monday)).toBe("2026-08-17")
  })

  it("falls back to today when neither param is given", () => {
    const { selectedDate, monday } = resolveScheduleDates(undefined, undefined)
    expect(selectedDate).toBe(today)
    expect(ymd(monday)).toBe(ymd(getMondayOfWeek(parseYmd(today))))
  })

  it("rejects anything that is not a bare yyyy-MM-dd date", () => {
    for (const bad of ["không-phải-ngày", "2026", "2026-08-20T20:00:00Z", "Dec 25 2026"]) {
      expect(resolveScheduleDates(bad, undefined).selectedDate).toBe(today)
    }
  })

  it("rejects a repeated param (Next gives string[] for ?day=a&day=b)", () => {
    expect(resolveScheduleDates(["2026-08-20", "2026-08-21"], undefined).selectedDate).toBe(today)
  })

  it("clamps far-future and far-past dates back to today", () => {
    // Guards materializeWeek, which is anon-callable and writes rows for
    // whatever week the URL names.
    const farFuture = ymd(addDays(addYears(parseYmd(today), 2), 1))
    const farPast = ymd(addDays(addYears(parseYmd(today), -2), -1))
    expect(resolveScheduleDates(farFuture, undefined).selectedDate).toBe(today)
    expect(resolveScheduleDates(farPast, undefined).selectedDate).toBe(today)
    // The edges of the window are still reachable.
    const edge = ymd(addYears(parseYmd(today), 2))
    expect(resolveScheduleDates(edge, undefined).selectedDate).toBe(edge)
  })

  it("always returns a monday that matches the selected date's week", () => {
    for (const day of ["2026-08-17", "2026-08-23", "2026-01-01", "2026-12-31"]) {
      const { selectedDate, monday } = resolveScheduleDates(day, undefined)
      expect(ymd(monday)).toBe(ymd(getMondayOfWeek(parseYmd(selectedDate))))
    }
  })
})
