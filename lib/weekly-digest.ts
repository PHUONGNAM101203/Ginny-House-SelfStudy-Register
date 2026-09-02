import { format } from "date-fns"

export type WeeklyDigestStats = {
  /** Active registrations in the week, keyed by branch name. */
  registrationsByBranch: Record<string, number>
  cancelled: number
  changeRequestsApproved: number
  changeRequestsPending: number
  newStudents: number
  activeRecurring: number
  /** Recurring slots currently sitting vacant, waiting for a replacement. */
  vacantRecurring: number
}

export type WeeklyDigest = {
  title: string
  body: string
  dedupeKey: string
}

function dm(date: Date) {
  return format(date, "dd/MM")
}

/**
 * Builds the Sunday-22:00 week wrap-up that lands in the notification bell.
 *
 * Kept as a pure function so the numbers can be tested without a database —
 * the cron route's only job is to go and count things.
 */
export function buildWeeklyDigest(monday: Date, sunday: Date, stats: WeeklyDigestStats): WeeklyDigest {
  const branches = Object.entries(stats.registrationsByBranch).filter(([, n]) => n > 0)
  const total = branches.reduce((sum, [, n]) => sum + n, 0)
  const perBranch = branches.map(([name, n]) => `${name} ${n}`).join(" · ")

  const lines = [
    `${total} lượt đăng ký${perBranch ? ` (${perBranch})` : ""}`,
    `${stats.cancelled} lượt huỷ`,
    `${stats.changeRequestsApproved + stats.changeRequestsPending} phiếu đổi/xoá lịch` +
      (stats.changeRequestsPending > 0 ? ` (${stats.changeRequestsPending} còn chờ duyệt)` : ""),
    `${stats.newStudents} học sinh mới`,
    `${stats.activeRecurring} lịch cố định đang chạy` +
      (stats.vacantRecurring > 0 ? ` · ${stats.vacantRecurring} chỗ cố định đang trống` : ""),
  ]

  return {
    title: `Tổng hợp tuần ${dm(monday)} – ${dm(sunday)}`,
    body: lines.join(" · "),
    // One digest per week, so a retried cron run (or a manual trigger)
    // updates the same row instead of stacking duplicates in the bell.
    dedupeKey: `weekly_digest:${format(monday, "yyyy-MM-dd")}`,
  }
}
