import { describe, expect, it } from "vitest"
import { parse } from "date-fns"
import {
  clampMonth,
  isMonthOutOfRange,
  monthsOfYear,
  yearsInRange,
} from "@/lib/date-picker-range"

const d = (ymd: string) => parse(ymd, "yyyy-MM-dd", new Date())

// The real picker window: today ± MAX_YEARS_FROM_TODAY. Fixed here rather than
// derived from `new Date()` so these tests never depend on the day they run.
const RANGE_START = d("2024-08-20")
const RANGE_END = d("2028-08-20")

describe("isMonthOutOfRange", () => {
  it("keeps the window's partial first month selectable", () => {
    // August 2024 starts before rangeStart but still contains 20-31 Aug.
    expect(isMonthOutOfRange(d("2024-08-01"), RANGE_START, RANGE_END)).toBe(false)
  })

  it("keeps the window's partial last month selectable", () => {
    // August 2028 runs past rangeEnd but still contains 1-20 Aug.
    expect(isMonthOutOfRange(d("2028-08-01"), RANGE_START, RANGE_END)).toBe(false)
  })

  it("rejects the month just before the window", () => {
    expect(isMonthOutOfRange(d("2024-07-01"), RANGE_START, RANGE_END)).toBe(true)
  })

  it("rejects the month just after the window", () => {
    expect(isMonthOutOfRange(d("2028-09-01"), RANGE_START, RANGE_END)).toBe(true)
  })

  it("accepts a month well inside the window", () => {
    expect(isMonthOutOfRange(d("2026-03-01"), RANGE_START, RANGE_END)).toBe(false)
  })

  it("treats a month containing the boundary day itself as in range", () => {
    // Degenerate single-day window: only that month survives.
    const only = d("2026-05-14")
    expect(isMonthOutOfRange(d("2026-05-01"), only, only)).toBe(false)
    expect(isMonthOutOfRange(d("2026-04-01"), only, only)).toBe(true)
    expect(isMonthOutOfRange(d("2026-06-01"), only, only)).toBe(true)
  })
})

describe("clampMonth", () => {
  it("leaves an in-range month untouched", () => {
    expect(clampMonth(d("2026-03-01"), RANGE_START, RANGE_END)).toEqual(d("2026-03-01"))
  })

  it("pulls an earlier month up to the window's first month", () => {
    // Not to rangeStart's *day* — month granularity is intended, the day grid
    // narrows the rest.
    expect(clampMonth(d("2020-01-01"), RANGE_START, RANGE_END)).toEqual(d("2024-08-01"))
  })

  it("pulls a later month down to the window's last month", () => {
    expect(clampMonth(d("2030-12-01"), RANGE_START, RANGE_END)).toEqual(d("2028-08-01"))
  })

  it("keeps the boundary months themselves", () => {
    expect(clampMonth(d("2024-08-01"), RANGE_START, RANGE_END)).toEqual(d("2024-08-01"))
    expect(clampMonth(d("2028-08-01"), RANGE_START, RANGE_END)).toEqual(d("2028-08-01"))
  })

  it("clamps the month just outside either edge to the nearest edge month", () => {
    expect(clampMonth(d("2024-07-01"), RANGE_START, RANGE_END)).toEqual(d("2024-08-01"))
    expect(clampMonth(d("2028-09-01"), RANGE_START, RANGE_END)).toEqual(d("2028-08-01"))
  })
})

describe("yearsInRange", () => {
  it("lists every year the window touches, inclusive and ascending", () => {
    expect(yearsInRange(RANGE_START, RANGE_END)).toEqual([2024, 2025, 2026, 2027, 2028])
  })

  it("returns a single year when the window sits inside one", () => {
    expect(yearsInRange(d("2026-02-01"), d("2026-11-30"))).toEqual([2026])
  })

  it("spans a year boundary as two years", () => {
    expect(yearsInRange(d("2026-12-31"), d("2027-01-01"))).toEqual([2026, 2027])
  })

  it("returns nothing for an inverted range rather than looping forever", () => {
    expect(yearsInRange(d("2028-01-01"), d("2024-01-01"))).toEqual([])
  })

  it("only ever lists years that contain a selectable day", () => {
    // This is what lets the year grid skip an out-of-range predicate entirely.
    for (const year of yearsInRange(RANGE_START, RANGE_END)) {
      const january = parse(`${year}-01-01`, "yyyy-MM-dd", new Date())
      const someMonthIsInRange = monthsOfYear(january).some(
        (month) => !isMonthOutOfRange(month, RANGE_START, RANGE_END)
      )
      expect(someMonthIsInRange).toBe(true)
    }
  })
})

describe("monthsOfYear", () => {
  it("returns the twelve months of the reference's year", () => {
    const months = monthsOfYear(d("2026-07-15"))
    expect(months).toHaveLength(12)
    expect(months.map((m) => m.getMonth())).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(months.every((m) => m.getFullYear() === 2026)).toBe(true)
  })

  it("puts every month on day 1, so a later setYear cannot slide Feb 29", () => {
    // Day 1 is what stops 29 Feb 2028 becoming 1 Mar 2027 on a year change.
    expect(monthsOfYear(d("2028-02-29")).every((m) => m.getDate() === 1)).toBe(true)
  })

  it("ignores the reference's own month and day", () => {
    expect(monthsOfYear(d("2026-12-31"))).toEqual(monthsOfYear(d("2026-01-01")))
  })
})
