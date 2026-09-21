import { describe, it, expect } from "vitest"
import { lockAppliesOn, describeLockScope, lockDayLabel, type SlotLockScope } from "@/lib/slot-locks"

// 2026-09-19 là Thứ 7 (isodow 6), 2026-09-26 là Thứ 7 kế tiếp,
// 2026-09-20 là Chủ nhật.
const SAT = "2026-09-19"
const NEXT_SAT = "2026-09-26"
const SUN = "2026-09-20"

function lock(overrides: Partial<SlotLockScope> = {}): SlotLockScope {
  return { dayOfWeek: null, effectiveFrom: null, effectiveTo: null, ...overrides }
}

describe("lockAppliesOn", () => {
  it("repeats every week for a legacy lock with no dates — unchanged behaviour", () => {
    const weekly = lock({ dayOfWeek: 6 })
    expect(lockAppliesOn(weekly, SAT)).toBe(true)
    expect(lockAppliesOn(weekly, NEXT_SAT)).toBe(true)
    expect(lockAppliesOn(weekly, SUN)).toBe(false)
  })

  it("covers one day only, which is the whole point of the thi thử case", () => {
    const oneOff = lock({ effectiveFrom: SAT, effectiveTo: SAT })
    expect(lockAppliesOn(oneOff, SAT)).toBe(true)
    expect(lockAppliesOn(oneOff, NEXT_SAT)).toBe(false)
    expect(lockAppliesOn(oneOff, "2026-09-18")).toBe(false)
  })

  it("covers a date range inclusive of both ends", () => {
    const range = lock({ effectiveFrom: "2026-09-15", effectiveTo: "2026-09-21" })
    expect(lockAppliesOn(range, "2026-09-15")).toBe(true)
    expect(lockAppliesOn(range, "2026-09-18")).toBe(true)
    expect(lockAppliesOn(range, "2026-09-21")).toBe(true)
    expect(lockAppliesOn(range, "2026-09-14")).toBe(false)
    expect(lockAppliesOn(range, "2026-09-22")).toBe(false)
  })

  it("keeps this week locked when an end date ends it from next week", () => {
    // Đây là hình dạng của nút "Gỡ khoá từ tuần sau": effective_to = Chủ nhật
    // tuần này. Tuần này vẫn khoá, tuần sau mở.
    const ending = lock({ dayOfWeek: 6, effectiveTo: SUN })
    expect(lockAppliesOn(ending, SAT)).toBe(true)
    expect(lockAppliesOn(ending, NEXT_SAT)).toBe(false)
  })

  it("honours a start date on a weekly lock", () => {
    const fromNextWeek = lock({ dayOfWeek: 6, effectiveFrom: NEXT_SAT })
    expect(lockAppliesOn(fromNextWeek, SAT)).toBe(false)
    expect(lockAppliesOn(fromNextWeek, NEXT_SAT)).toBe(true)
  })
})

describe("describeLockScope", () => {
  it("tells a weekly lock apart from a one-off in plain words", () => {
    expect(describeLockScope(lock({ dayOfWeek: 6 }))).toBe("lặp lại hằng tuần")
    expect(describeLockScope(lock({ effectiveFrom: SAT, effectiveTo: SAT }))).toBe("chỉ ngày 19/09")
  })

  it("spells out a date range", () => {
    expect(describeLockScope(lock({ effectiveFrom: "2026-09-15", effectiveTo: "2026-09-21" }))).toBe(
      "từ 15/09 đến 21/09"
    )
  })

  it("says when a weekly lock stops repeating", () => {
    expect(describeLockScope(lock({ dayOfWeek: 6, effectiveTo: SUN }))).toBe("mọi Thứ 7, đến hết 20/09")
  })

  it("says when a weekly lock starts", () => {
    expect(describeLockScope(lock({ dayOfWeek: 6, effectiveFrom: NEXT_SAT }))).toBe("mọi Thứ 7, từ 26/09 trở đi")
  })

  it("bounds a weekly lock on both sides", () => {
    expect(describeLockScope(lock({ dayOfWeek: 6, effectiveFrom: "2026-09-20", effectiveTo: "2026-10-31" }))).toBe(
      "mọi Thứ 7, từ 20/09 đến 31/10"
    )
  })
})

describe("lockDayLabel", () => {
  it("names the weekday for a repeating lock and the date for a one-off", () => {
    expect(lockDayLabel(lock({ dayOfWeek: 6 }))).toBe("Thứ 7")
    expect(lockDayLabel(lock({ effectiveFrom: SAT, effectiveTo: SAT }))).toBe("Thứ 7 19/09")
  })
})
