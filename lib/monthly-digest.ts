import { format } from "date-fns"
import { parseYmd } from "@/lib/vn-date"

export type MonthlyDigestStats = {
  /** Active registrations in the month, keyed by branch name. */
  registrationsByBranch: Record<string, number>
  cancelled: number
  changeRequestsApproved: number
  changeRequestsPending: number
  newStudents: number
  activeRecurring: number
  /** Recurring slots currently sitting vacant, waiting for a replacement. */
  vacantRecurring: number
  /** How many different students actually sat at least once this month. */
  distinctStudents: number
  /** Booked hours across the whole month, already rounded. */
  totalHours: number
  /** "yyyy-MM-dd" of the single busiest day, or null for an empty month. */
  busiestDate: string | null
  busiestCount: number
  /** Active registrations in the month before — the trend line. */
  previousTotal: number
}

export type MonthlyDigest = {
  title: string
  body: string
  dedupeKey: string
}

/**
 * Builds the end-of-month wrap-up that lands in the notification bell on the
 * last day of the month, alongside the Sunday weekly one
 * (see lib/weekly-digest.ts).
 *
 * It answers a different question from the weekly digest: not "what happened
 * this week" but "how did the month go" — hence the month-on-month
 * comparison, the head count, the hours, and the busiest day, none of which
 * say much across seven days.
 *
 * Pure, so the numbers can be tested without a database. The cron route's
 * only job is to go and count things.
 */
export function buildMonthlyDigest(monthStart: Date, stats: MonthlyDigestStats): MonthlyDigest {
  const branches = Object.entries(stats.registrationsByBranch).filter(([, n]) => n > 0)
  const total = branches.reduce((sum, [, n]) => sum + n, 0)
  const perBranch = branches.map(([name, n]) => `${name} ${n}`).join(" · ")

  // No previous month on record means no trend to draw: "+120 so với tháng
  // trước" in the very first month would read as growth that never happened.
  const delta = total - stats.previousTotal
  const trend =
    stats.previousTotal > 0 ? ` (tháng trước ${stats.previousTotal}, ${delta >= 0 ? "+" : "-"}${Math.abs(delta)})` : ""

  const changeRequests = stats.changeRequestsApproved + stats.changeRequestsPending

  const lines = [
    `${total} lượt đăng ký${perBranch ? ` (${perBranch})` : ""}${trend}`,
    `${stats.distinctStudents} học sinh · ${stats.totalHours} giờ tự học`,
    `${stats.cancelled} lượt huỷ`,
    `${changeRequests} phiếu đổi/xoá lịch` +
      (stats.changeRequestsPending > 0 ? ` (${stats.changeRequestsPending} còn chờ duyệt)` : ""),
    `${stats.newStudents} học sinh mới`,
    `${stats.activeRecurring} lịch cố định đang chạy` +
      (stats.vacantRecurring > 0 ? ` · ${stats.vacantRecurring} chỗ cố định đang trống` : ""),
  ]
  // An empty month has no busiest day, and "Ngày đông nhất —" is worse than
  // saying nothing.
  if (stats.busiestDate) {
    lines.push(`Ngày đông nhất ${format(parseYmd(stats.busiestDate), "dd/MM")} (${stats.busiestCount} lượt)`)
  }

  return {
    title: `Tổng kết tháng ${format(monthStart, "MM/yyyy")}`,
    body: lines.join(" · "),
    // One digest per calendar month, so a retried cron run (or a manual
    // trigger) updates the same row instead of stacking duplicates.
    dedupeKey: `monthly_digest:${format(monthStart, "yyyy-MM")}`,
  }
}
