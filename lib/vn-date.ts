import { format, isValid, parse } from "date-fns"

export const VN_TIME_ZONE = "Asia/Ho_Chi_Minh"

const YMD = /^\d{4}-\d{2}-\d{2}$/

// Calendar days are passed between the server and the client as "yyyy-MM-dd"
// strings, never as Date objects.
//
// Why: a Date is an *instant*. `new Date("2026-08-20")` is UTC midnight, which
// the ICT-pinned server renders as 20/08 but a browser in UTC renders as 19/08.
// Serializing that instant through the RSC boundary therefore shifted the whole
// grid a day for any viewer west of +07, and made "next day" a no-op (the
// client would compute 19/08 + 1 = 20/08 — the URL it was already on).
// Strings have no such ambiguity; each side turns them into its own local
// midnight only when it needs a Date to compute with.

const vnPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: VN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

/** Today's calendar date in Vietnam, as "yyyy-MM-dd". */
export function vietnamToday(): string {
  const parts = vnPartsFormatter.formatToParts(new Date())
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

/** "yyyy-MM-dd" → that calendar day at local midnight. */
export function parseYmd(value: string): Date {
  return parse(value, "yyyy-MM-dd", new Date())
}

/** A local Date → its calendar day as "yyyy-MM-dd". */
export function toYmd(date: Date): string {
  return format(date, "yyyy-MM-dd")
}

/** Parse a URL search param that is supposed to be a "yyyy-MM-dd" date. */
export function parseYmdParam(value: string | string[] | undefined): string | null {
  // Next hands back string[] for a repeated param (?day=a&day=b), so the type
  // has to admit that rather than trusting the declared `string`.
  if (typeof value !== "string" || !YMD.test(value)) return null
  return isValid(parseYmd(value)) ? value : null
}
