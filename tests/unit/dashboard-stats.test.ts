import { describe, it, expect } from "vitest"
import {
  countByDate,
  countByBranch,
  countByDesk,
  countByStartTime,
  countByKind,
  countDistinctStudents,
  totalBookedHours,
  type StatRegistration,
} from "@/lib/dashboard-stats"

const reg = (over: Partial<StatRegistration> = {}): StatRegistration => ({
  studentId: "s1",
  studentName: "A",
  branchId: "b1",
  deskId: "d1",
  date: "2026-09-07",
  startTime: "08:00",
  endTime: "10:00",
  status: "active",
  recurringRegistrationId: null,
  ...over,
})

const week = ["2026-09-07", "2026-09-08", "2026-09-09"]

describe("countByDate", () => {
  it("returns a slot for every day of the week, zeros included", () => {
    expect(countByDate([reg()], week)).toEqual([
      { label: "2026-09-07", count: 1 },
      { label: "2026-09-08", count: 0 },
      { label: "2026-09-09", count: 0 },
    ])
  })

  it("ignores cancelled bookings and days outside the week", () => {
    const rows = [reg(), reg({ status: "cancelled" }), reg({ date: "2026-10-01" })]
    expect(countByDate(rows, week)[0].count).toBe(1)
  })
})

describe("countByBranch", () => {
  const names = new Map([["b1", "Cơ sở Hoàng Gia"], ["b2", "Cơ sở Hồ Xương Rồng"]])

  it("counts per branch, busiest first", () => {
    const rows = [reg(), reg(), reg({ branchId: "b2" })]
    expect(countByBranch(rows, names)).toEqual([
      { label: "Cơ sở Hoàng Gia", count: 2 },
      { label: "Cơ sở Hồ Xương Rồng", count: 1 },
    ])
  })

  it("drops rows whose branch is unknown rather than labelling them undefined", () => {
    expect(countByBranch([reg({ branchId: "gone" })], names)).toEqual([])
  })
})

describe("countByDesk / countByStartTime", () => {
  it("ranks desks and caps the list", () => {
    const labels = new Map([["d1", "Chỗ 1"], ["d2", "Chỗ 2"]])
    const rows = [reg(), reg({ deskId: "d2" }), reg({ deskId: "d2" })]
    expect(countByDesk(rows, labels, 1)).toEqual([{ label: "Chỗ 2", count: 2 }])
  })

  it("ranks start times", () => {
    const rows = [reg({ startTime: "14:00" }), reg({ startTime: "14:00" }), reg()]
    expect(countByStartTime(rows)[0]).toEqual({ label: "14:00", count: 2 })
  })

  it("breaks ties by label so the order does not wobble between renders", () => {
    const labels = new Map([["d1", "Chỗ 1"], ["d2", "Chỗ 2"]])
    expect(countByDesk([reg({ deskId: "d2" }), reg()], labels).map((r) => r.label)).toEqual(["Chỗ 1", "Chỗ 2"])
  })
})

describe("countByKind", () => {
  it("splits the four card types the calendar draws", () => {
    const rows = [
      reg(),
      reg({ recurringRegistrationId: "r1" }),
      reg({ studentId: null, studentName: null, recurringRegistrationId: "r2" }),
      reg({ status: "cancelled" }),
    ]
    expect(countByKind(rows)).toEqual({ normal: 1, recurring: 1, vacant: 1, cancelled: 1 })
  })

  it("counts a cancelled recurring booking as cancelled, not recurring", () => {
    expect(countByKind([reg({ status: "cancelled", recurringRegistrationId: "r1" })]).recurring).toBe(0)
  })
})

describe("countDistinctStudents", () => {
  it("counts each student once however many bookings they hold", () => {
    expect(countDistinctStudents([reg(), reg(), reg({ studentId: "s2" })])).toBe(2)
  })

  it("ignores vacant placeholders, which belong to nobody", () => {
    expect(countDistinctStudents([reg({ studentId: null })])).toBe(0)
  })
})

describe("totalBookedHours", () => {
  it("adds up the booked time", () => {
    expect(totalBookedHours([reg(), reg({ startTime: "14:00", endTime: "14:30" })])).toBe(2.5)
  })

  it("leaves cancelled bookings out", () => {
    expect(totalBookedHours([reg({ status: "cancelled" })])).toBe(0)
  })
})
