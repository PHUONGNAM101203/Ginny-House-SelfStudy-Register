import { describe, it, expect } from "vitest"
import { buildMonthlyDigest, type MonthlyDigestStats } from "@/lib/monthly-digest"

const SEPTEMBER_START = new Date(2026, 8, 1)

function stats(overrides: Partial<MonthlyDigestStats> = {}): MonthlyDigestStats {
  return {
    registrationsByBranch: { "Cơ sở Hoàng Gia": 80, "Cơ sở Hồ Xương Rồng": 40 },
    cancelled: 7,
    changeRequestsApproved: 3,
    changeRequestsPending: 2,
    newStudents: 5,
    activeRecurring: 28,
    vacantRecurring: 2,
    distinctStudents: 46,
    totalHours: 214,
    busiestDate: "2026-09-12",
    busiestCount: 11,
    previousTotal: 100,
    ...overrides,
  }
}

describe("buildMonthlyDigest", () => {
  it("names the month it is summarising", () => {
    expect(buildMonthlyDigest(SEPTEMBER_START, stats()).title).toBe("Tổng kết tháng 09/2026")
  })

  it("totals the branches and lists each one", () => {
    const { body } = buildMonthlyDigest(SEPTEMBER_START, stats())
    expect(body).toContain("120 lượt đăng ký (Cơ sở Hoàng Gia 80 · Cơ sở Hồ Xương Rồng 40)")
  })

  it("compares against the month before", () => {
    const { body } = buildMonthlyDigest(SEPTEMBER_START, stats())
    expect(body).toContain("tháng trước 100, +20")
  })

  it("marks a drop with a minus rather than a bare number", () => {
    const { body } = buildMonthlyDigest(SEPTEMBER_START, stats({ previousTotal: 150 }))
    expect(body).toContain("tháng trước 150, -30")
  })

  it("says nothing about a comparison when there is no month before to compare with", () => {
    const { body } = buildMonthlyDigest(SEPTEMBER_START, stats({ previousTotal: 0 }))
    expect(body).not.toContain("tháng trước")
  })

  it("reports how many students actually sat, and for how long", () => {
    const { body } = buildMonthlyDigest(SEPTEMBER_START, stats())
    expect(body).toContain("46 học sinh")
    expect(body).toContain("214 giờ tự học")
  })

  it("names the busiest day in dd/MM", () => {
    const { body } = buildMonthlyDigest(SEPTEMBER_START, stats())
    expect(body).toContain("Ngày đông nhất 12/09 (11 lượt)")
  })

  it("leaves out the busiest day when the month had no bookings at all", () => {
    const { body } = buildMonthlyDigest(
      SEPTEMBER_START,
      stats({ registrationsByBranch: {}, busiestDate: null, busiestCount: 0, previousTotal: 0 })
    )
    expect(body).toContain("0 lượt đăng ký")
    expect(body).not.toContain("Ngày đông nhất")
  })

  it("only mentions pending change requests when some are still waiting", () => {
    const busy = buildMonthlyDigest(SEPTEMBER_START, stats())
    expect(busy.body).toContain("5 phiếu đổi/xoá lịch (2 còn chờ duyệt)")
    const clear = buildMonthlyDigest(SEPTEMBER_START, stats({ changeRequestsPending: 0 }))
    expect(clear.body).toContain("3 phiếu đổi/xoá lịch")
    expect(clear.body).not.toContain("chờ duyệt")
  })

  it("only mentions vacant recurring slots when there are any", () => {
    const { body } = buildMonthlyDigest(SEPTEMBER_START, stats({ vacantRecurring: 0 }))
    expect(body).toContain("28 lịch cố định đang chạy")
    expect(body).not.toContain("đang trống")
  })

  it("keys one digest per calendar month, so a retried run updates it in place", () => {
    expect(buildMonthlyDigest(SEPTEMBER_START, stats()).dedupeKey).toBe("monthly_digest:2026-09")
  })
})
