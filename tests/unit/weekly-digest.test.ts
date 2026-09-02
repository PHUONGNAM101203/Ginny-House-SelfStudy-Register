import { describe, it, expect } from "vitest"
import { buildWeeklyDigest, type WeeklyDigestStats } from "@/lib/weekly-digest"
import { parseYmd } from "@/lib/vn-date"

const monday = parseYmd("2026-08-24")
const sunday = parseYmd("2026-08-30")

const base: WeeklyDigestStats = {
  registrationsByBranch: { "Cơ sở Hoàng Gia": 24, "Cơ sở Hồ Xương Rồng": 18 },
  cancelled: 5,
  changeRequestsApproved: 2,
  changeRequestsPending: 1,
  newStudents: 6,
  activeRecurring: 12,
  vacantRecurring: 0,
}

describe("buildWeeklyDigest", () => {
  it("titles the digest with the week it covers", () => {
    expect(buildWeeklyDigest(monday, sunday, base).title).toBe("Tổng hợp tuần 24/08 – 30/08")
  })

  it("totals registrations across branches and names each one", () => {
    expect(buildWeeklyDigest(monday, sunday, base).body).toContain(
      "42 lượt đăng ký (Cơ sở Hoàng Gia 24 · Cơ sở Hồ Xương Rồng 18)"
    )
  })

  it("omits branches with nothing booked rather than printing a zero", () => {
    const body = buildWeeklyDigest(monday, sunday, {
      ...base,
      registrationsByBranch: { "Cơ sở Hoàng Gia": 3, "Cơ sở Hồ Xương Rồng": 0 },
    }).body
    expect(body).toContain("3 lượt đăng ký (Cơ sở Hoàng Gia 3)")
    expect(body).not.toContain("Hồ Xương Rồng")
  })

  it("flags change requests still waiting on the admin", () => {
    expect(buildWeeklyDigest(monday, sunday, base).body).toContain("3 phiếu đổi/xoá lịch (1 còn chờ duyệt)")
  })

  it("stays quiet about pending requests when there are none", () => {
    const body = buildWeeklyDigest(monday, sunday, { ...base, changeRequestsPending: 0 }).body
    expect(body).toContain("2 phiếu đổi/xoá lịch")
    expect(body).not.toContain("còn chờ duyệt")
  })

  it("mentions vacant recurring slots only when some exist", () => {
    expect(buildWeeklyDigest(monday, sunday, base).body).not.toContain("đang trống")
    expect(buildWeeklyDigest(monday, sunday, { ...base, vacantRecurring: 2 }).body).toContain(
      "2 chỗ cố định đang trống"
    )
  })

  it("dedupes on the week's Monday so a retried run updates one row", () => {
    expect(buildWeeklyDigest(monday, sunday, base).dedupeKey).toBe("weekly_digest:2026-08-24")
  })

  it("survives a week with no activity at all", () => {
    const digest = buildWeeklyDigest(monday, sunday, {
      registrationsByBranch: { "Cơ sở Hoàng Gia": 0 },
      cancelled: 0,
      changeRequestsApproved: 0,
      changeRequestsPending: 0,
      newStudents: 0,
      activeRecurring: 0,
      vacantRecurring: 0,
    })
    expect(digest.body).toContain("0 lượt đăng ký")
    expect(digest.body).not.toContain("()")
  })
})
