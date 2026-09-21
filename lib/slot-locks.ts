import { DAY_LABELS } from "@/lib/validations/slot-lock"

/**
 * The part of a slot lock that decides *which days* it covers — branch, desk
 * and time range are handled the same way they always were.
 *
 * Four shapes, one row (migration 0041):
 *
 *   dayOfWeek | effectiveFrom | effectiveTo | nghĩa
 *   ----------+---------------+-------------+-----------------------------
 *   6         | null          | null        | mọi Thứ 7, mãi mãi
 *   6         | 2026-09-20    | 2026-10-31  | mọi Thứ 7 trong khoảng đó
 *   null      | 2026-09-19    | 2026-09-19  | đúng một ngày
 *   null      | 2026-09-15    | 2026-09-21  | một khoảng ngày
 */
export type SlotLockScope = {
  dayOfWeek: number | null
  /** "yyyy-MM-dd", or null for "no lower bound". */
  effectiveFrom: string | null
  /** "yyyy-MM-dd", or null for "no upper bound". */
  effectiveTo: string | null
}

/**
 * ISO weekday (1 = Thứ 2 … 7 = Chủ nhật) of a "yyyy-MM-dd" string.
 *
 * Built in UTC on purpose: a local-midnight Date is an instant, so in any
 * timezone west of Asia/Ho_Chi_Minh it lands on the previous calendar day and
 * a Thứ 7 lock would quietly start covering Thứ 6.
 */
function isoDayOfWeek(date: string): number {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1
}

/**
 * Whether a lock covers this date. Mirrors the `slot_lock_blocks` SQL
 * function (migration 0041) exactly — the database is the authority that
 * actually refuses a booking; this is what stops the calendar from *drawing*
 * a one-off lock on every week, which would be a visible lie.
 *
 * Dates are compared as "yyyy-MM-dd" strings, which sort chronologically, so
 * no Date objects and no timezones are involved.
 */
export function lockAppliesOn(lock: SlotLockScope, date: string): boolean {
  if (lock.dayOfWeek !== null && lock.dayOfWeek !== isoDayOfWeek(date)) return false
  if (lock.effectiveFrom !== null && date < lock.effectiveFrom) return false
  if (lock.effectiveTo !== null && date > lock.effectiveTo) return false
  return true
}

/** "2026-09-19" → "19/09". */
function dm(date: string): string {
  const [, month, day] = date.split("-")
  return `${day}/${month}`
}

/**
 * How far a lock reaches, in words.
 *
 * Whoever is about to remove a lock has to see what it covers before they
 * touch it: "lặp lại hằng tuần" and "chỉ ngày 19/09" are the same row shape
 * with very different consequences, and confusing the two is exactly how the
 * thi thử day got opened for booking.
 */
export function describeLockScope(lock: SlotLockScope): string {
  const { dayOfWeek, effectiveFrom, effectiveTo } = lock

  if (dayOfWeek === null) {
    // Date-bounded with no weekday: one day, or a run of days.
    if (effectiveFrom && effectiveTo && effectiveFrom === effectiveTo) return `chỉ ngày ${dm(effectiveFrom)}`
    if (effectiveFrom && effectiveTo) return `từ ${dm(effectiveFrom)} đến ${dm(effectiveTo)}`
    if (effectiveFrom) return `từ ${dm(effectiveFrom)} trở đi`
    // No weekday and no start date is refused by the DB constraint
    // slot_locks_needs_scope, so this is unreachable from real data.
    return "mọi ngày"
  }

  const day = DAY_LABELS[dayOfWeek] ?? `Thứ ${dayOfWeek}`
  if (!effectiveFrom && !effectiveTo) return "lặp lại hằng tuần"
  if (effectiveFrom && effectiveTo) return `mọi ${day}, từ ${dm(effectiveFrom)} đến ${dm(effectiveTo)}`
  if (effectiveTo) return `mọi ${day}, đến hết ${dm(effectiveTo)}`
  return `mọi ${day}, từ ${dm(effectiveFrom!)} trở đi`
}

/**
 * What the table's first column says: a one-off lock is recognised by its
 * date, a weekly one by its weekday.
 */
export function lockDayLabel(lock: SlotLockScope): string {
  if (lock.dayOfWeek !== null) return DAY_LABELS[lock.dayOfWeek] ?? `Thứ ${lock.dayOfWeek}`
  if (lock.effectiveFrom) {
    const day = DAY_LABELS[isoDayOfWeek(lock.effectiveFrom)] ?? ""
    return `${day} ${dm(lock.effectiveFrom)}`.trim()
  }
  return "—"
}
