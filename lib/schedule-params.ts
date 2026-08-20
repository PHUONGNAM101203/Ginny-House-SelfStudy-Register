import { getMondayOfWeek } from "@/lib/week"
import { parseYmd, parseYmdParam, toYmd, vietnamToday } from "@/lib/vn-date"
import { addYears } from "date-fns"

export type ScheduleDates = {
  /** The single day the grid renders, as "yyyy-MM-dd" (see lib/vn-date.ts). */
  selectedDate: string
  /** Monday of `selectedDate`'s week — the range getScheduleData fetches. */
  monday: Date
}

// How far either side of today a URL is allowed to point. Matches the range the
// date picker offers (DateNavigator's startMonth/endMonth), and — more
// importantly — bounds `materializeWeek`, which the guest page calls on every
// request with whatever week the URL asks for. That RPC is security-definer and
// granted to `anon`, so without a clamp an unauthenticated `?day=3000-01-01`
// would insert a recurring row per rule dated in the year 3000, once per
// distinct week an attacker names.
// Exported so the date picker bounds itself to exactly this window rather than
// keeping a second copy in sync by comment (which is how it was done before).
export const MAX_YEARS_FROM_TODAY = 2

/**
 * Resolve the `?day=` / `?week=` search params into the day the grid shows and
 * the week that has to be fetched for it.
 *
 * The grid renders one day at a time but `getScheduleData` still fetches a
 * whole week (its queries and tests are unchanged), so these two always travel
 * together and `monday` is always derived from `selectedDate` — that way a
 * stale or hand-edited `week` param can never disagree with the day on screen.
 *
 * Precedence:
 *  1. `day` wins when present and a valid "yyyy-MM-dd".
 *  2. `week` alone (older links, before the single-day redesign) opens that
 *     week's Monday.
 *  3. Otherwise, and for anything outside the allowed window: today.
 */
export function resolveScheduleDates(
  dayParam?: string | string[],
  weekParam?: string | string[]
): ScheduleDates {
  const today = vietnamToday()

  const day = parseYmdParam(dayParam)
  if (day) return clamp(day, today)

  const week = parseYmdParam(weekParam)
  if (week) return clamp(toYmd(getMondayOfWeek(parseYmd(week))), today)

  return forDate(today)
}

function clamp(candidate: string, today: string): ScheduleDates {
  const todayDate = parseYmd(today)
  const min = toYmd(addYears(todayDate, -MAX_YEARS_FROM_TODAY))
  const max = toYmd(addYears(todayDate, MAX_YEARS_FROM_TODAY))
  // String comparison is exact for "yyyy-MM-dd".
  if (candidate < min || candidate > max) return forDate(today)
  return forDate(candidate)
}

function forDate(selectedDate: string): ScheduleDates {
  return { selectedDate, monday: getMondayOfWeek(parseYmd(selectedDate)) }
}
