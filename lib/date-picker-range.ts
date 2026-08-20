import { endOfMonth, isAfter, isBefore, setMonth, startOfMonth, startOfYear } from "date-fns"

/**
 * Range arithmetic for the date picker's month and year grids.
 *
 * Split out of the component so it can be unit-tested at the edges of the
 * allowed window — the interesting cases are the partially-in-range first and
 * last months, which no end-to-end test happens to land on.
 *
 * Every function here takes the window as explicit `rangeStart`/`rangeEnd`
 * bounds (inclusive, day-granular) rather than reading today's date, so the
 * tests are not time-dependent.
 */

/** 0-11, the twelve month indexes in display order. */
export const MONTH_INDEXES = Array.from({ length: 12 }, (_, i) => i)

/**
 * Pull `month` inside the window, at month granularity.
 *
 * Month-granular on purpose: the day grid narrows further via its own
 * `disabled={{ before, after }}` matcher, so landing on the first/last month
 * with some days disabled is the correct outcome, not an error.
 */
export function clampMonth(month: Date, rangeStart: Date, rangeEnd: Date): Date {
  const min = startOfMonth(rangeStart)
  const max = startOfMonth(rangeEnd)
  if (isBefore(month, min)) return min
  if (isAfter(month, max)) return max
  return month
}

/**
 * True only when *no* day of `month` falls inside the window.
 *
 * A partially-in-range month (the window's first and last) stays selectable —
 * it still contains days the user is allowed to pick.
 */
export function isMonthOutOfRange(month: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return isBefore(endOfMonth(month), rangeStart) || isAfter(startOfMonth(month), rangeEnd)
}

/**
 * The years the picker offers, ascending.
 *
 * Every year here contains at least one selectable day by construction, since
 * the list is built from the bounds themselves — so the year grid needs no
 * out-of-range predicate of its own.
 */
export function yearsInRange(rangeStart: Date, rangeEnd: Date): number[] {
  const first = rangeStart.getFullYear()
  const last = rangeEnd.getFullYear()
  if (last < first) return []
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

/**
 * The twelve months of `reference`'s calendar year, each at day 1.
 *
 * Day 1 matters: it is what keeps a later `setYear` from sliding a 29 February
 * into 1 March.
 */
export function monthsOfYear(reference: Date): Date[] {
  const january = startOfYear(reference)
  return MONTH_INDEXES.map((index) => setMonth(january, index))
}
