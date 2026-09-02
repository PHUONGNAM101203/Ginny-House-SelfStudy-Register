import { describe, it, expect } from "vitest"
import { formatBookingSummary } from "@/lib/booking-summary"

const base = {
  fullName: "Nguyễn Văn A",
  className: "L2-04-26",
  date: "2026-09-04",
  startTime: "14:30",
  endTime: "17:30",
  branchName: "Cơ sở Hoàng Gia",
  deskLabel: "Chỗ 2",
}

describe("formatBookingSummary", () => {
  it("matches the wording the notification bell uses", () => {
    expect(formatBookingSummary(base)).toBe(
      "Nguyễn Văn A · L2-04-26 — 04/09 14:30-17:30 · Cơ sở Hoàng Gia · Chỗ 2"
    )
  })

  it("writes the date as dd/MM, not the raw ISO string", () => {
    // The push used to read "— 2026-09-04 14:30-17:30", which is what this
    // helper exists to stop.
    expect(formatBookingSummary(base)).not.toContain("2026-09-04")
  })

  it("drops the class when the student has none", () => {
    expect(formatBookingSummary({ ...base, className: null })).toBe(
      "Nguyễn Văn A — 04/09 14:30-17:30 · Cơ sở Hoàng Gia · Chỗ 2"
    )
  })

  it("omits the location entirely rather than printing a dangling separator", () => {
    expect(formatBookingSummary({ ...base, branchName: null, deskLabel: null })).toBe(
      "Nguyễn Văn A · L2-04-26 — 04/09 14:30-17:30"
    )
  })

  it("keeps whichever half of the location it was given", () => {
    expect(formatBookingSummary({ ...base, deskLabel: null })).toBe(
      "Nguyễn Văn A · L2-04-26 — 04/09 14:30-17:30 · Cơ sở Hoàng Gia"
    )
  })
})
