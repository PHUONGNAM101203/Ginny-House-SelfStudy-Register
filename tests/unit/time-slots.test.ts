import { describe, it, expect } from "vitest"
import { TIME_SLOTS } from "@/lib/time-slots"

describe("TIME_SLOTS", () => {
  it("has 24 thirty-minute slots (8-12 + 14-22, no lunch)", () => {
    expect(TIME_SLOTS).toHaveLength(24)
  })
  it("starts at 08:00 and ends at 22:00, skipping 12:00-14:00", () => {
    expect(TIME_SLOTS[0]).toEqual({ start: "08:00", end: "08:30" })
    expect(TIME_SLOTS.at(-1)).toEqual({ start: "21:30", end: "22:00" })
    expect(TIME_SLOTS.some((s) => s.start === "12:00")).toBe(false)
    expect(TIME_SLOTS.some((s) => s.start === "13:30")).toBe(false)
  })
})
