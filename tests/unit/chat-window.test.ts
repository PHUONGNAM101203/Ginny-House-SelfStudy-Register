import { describe, it, expect } from "vitest"
import { isChatWindowOpen } from "@/lib/chat-window"

describe("isChatWindowOpen", () => {
  it("returns true when now is inside the slot window (VN time)", () => {
    // 2026-08-22 08:15 giờ VN = 2026-08-22T01:15:00Z (UTC+7)
    const now = new Date("2026-08-22T01:15:00Z")
    expect(isChatWindowOpen("2026-08-22", "08:00", "08:30", now)).toBe(true)
  })

  it("returns false before the slot starts", () => {
    const now = new Date("2026-08-22T00:00:00Z") // 07:00 giờ VN
    expect(isChatWindowOpen("2026-08-22", "08:00", "08:30", now)).toBe(false)
  })

  it("returns false after the slot ends", () => {
    const now = new Date("2026-08-22T02:00:00Z") // 09:00 giờ VN
    expect(isChatWindowOpen("2026-08-22", "08:00", "08:30", now)).toBe(false)
  })

  it("end_time is exclusive — exactly at end_time is closed", () => {
    const now = new Date("2026-08-22T01:30:00Z") // đúng 08:30 giờ VN
    expect(isChatWindowOpen("2026-08-22", "08:00", "08:30", now)).toBe(false)
  })

  it("start_time is inclusive — exactly at start_time is open", () => {
    const now = new Date("2026-08-22T01:00:00Z") // đúng 08:00 giờ VN
    expect(isChatWindowOpen("2026-08-22", "08:00", "08:30", now)).toBe(true)
  })
})
