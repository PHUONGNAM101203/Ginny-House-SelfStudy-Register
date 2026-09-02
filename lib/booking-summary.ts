import { format } from "date-fns"
import { parseYmd } from "@/lib/vn-date"

/**
 * The one-line description of a booking that both the notification bell and
 * the push message use: "Nguyễn Văn A · L2-04-26 — 04/09 14:30-17:30 · Cơ sở
 * Hoàng Gia · Chỗ 2".
 *
 * create_registration builds the same string in SQL for the bell row (it
 * can't call into TypeScript); this is the push side. Kept identical on
 * purpose — a push that says less than the notification it announces is the
 * bug this replaces, where push showed a raw ISO date and no cơ sở at all.
 */
export function formatBookingSummary({
  fullName,
  className,
  date,
  startTime,
  endTime,
  branchName,
  deskLabel,
}: {
  fullName: string
  className?: string | null
  /** "yyyy-MM-dd" */
  date: string
  startTime: string
  endTime: string
  branchName?: string | null
  deskLabel?: string | null
}): string {
  const who = className ? `${fullName} · ${className}` : fullName
  const when = `${format(parseYmd(date), "dd/MM")} ${startTime}-${endTime}`
  const where = [branchName, deskLabel].filter(Boolean).join(" · ")
  return where ? `${who} — ${when} · ${where}` : `${who} — ${when}`
}
