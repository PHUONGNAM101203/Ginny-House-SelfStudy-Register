import { describe, it, expect } from "vitest"
import { format } from "date-fns"
import { getMondayOfWeek, getWeekDates } from "@/lib/week"

describe("getMondayOfWeek", () => {
  it("returns the same Monday when given a Wednesday", () => {
    const monday = getMondayOfWeek(new Date("2026-08-19"))
    expect(format(monday, "yyyy-MM-dd")).toBe("2026-08-17")
  })
})

describe("getWeekDates", () => {
  it("returns 7 consecutive dates starting Monday", () => {
    const dates = getWeekDates(new Date("2026-08-17"))
    expect(dates).toHaveLength(7)
    expect(format(dates[0], "yyyy-MM-dd")).toBe("2026-08-17")
    expect(format(dates[6], "yyyy-MM-dd")).toBe("2026-08-23")
  })
})
