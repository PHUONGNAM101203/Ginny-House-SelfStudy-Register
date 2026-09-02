/**
 * Lark Bitable hands a cell back in whichever shape its column type uses:
 * a bare string, a number, a rich-text array of segments, a person array, a
 * {text, link} for URL columns. Every one of those can legitimately hold a
 * student's name or phone depending on how the base was set up, so the
 * mapping normalises them all to plain text rather than assuming one.
 */
export type LarkFieldValue = unknown

export type LarkRecord = {
  record_id: string
  fields: Record<string, LarkFieldValue>
}

export type MappedStudent = {
  fullName: string
  phone: string
  larkRecordId: string
}

export type LarkFieldNames = {
  fullName: string
  phone: string
  status: string
}

function segmentText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return value.map(segmentText).join("")
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    // Rich text segments, person cells and URL cells in that order — all
    // three carry the human-readable value under one of these keys.
    for (const key of ["text", "name", "en_name", "link"]) {
      if (typeof obj[key] === "string") return obj[key] as string
    }
  }
  return ""
}

export function larkFieldToText(value: LarkFieldValue): string {
  return segmentText(value).trim()
}

/**
 * Vietnamese mobile numbers reach the base in every shape a human can type:
 * "0912 345 678", "0912.345.678", "+84912345678", or as a number column that
 * already ate the leading zero. `phone` is the upsert key on students, so an
 * unnormalised number silently creates a duplicate student instead of
 * updating the existing one.
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, "")
  if (digits.startsWith("+84")) digits = "0" + digits.slice(3)
  else if (digits.startsWith("84") && digits.length >= 11) digits = "0" + digits.slice(2)
  digits = digits.replace(/\D/g, "")
  // A number-typed column drops the leading zero: 912345678 -> 0912345678.
  if (digits.length === 9 && !digits.startsWith("0")) digits = "0" + digits
  return digits
}

/**
 * Rows without a usable name or phone are skipped, not guessed at — a blank
 * phone would collide on the students.phone unique key and merge unrelated
 * people into one record.
 */
export function mapLarkRecords(
  records: LarkRecord[],
  fields: LarkFieldNames,
  statusAllowlist: string[] = []
): { students: MappedStudent[]; skipped: { recordId: string; reason: string }[]; filteredOut: number } {
  const students: MappedStudent[] = []
  const skipped: { recordId: string; reason: string }[] = []
  const seenPhones = new Set<string>()
  let filteredOut = 0

  for (const record of records) {
    // Rows outside the allowlist are counted, not reported one by one — with
    // a CRM of a thousand leads the "skipped" list would be all noise.
    if (statusAllowlist.length > 0) {
      const status = larkFieldToText(record.fields[fields.status])
      if (!statusAllowlist.includes(status)) {
        filteredOut += 1
        continue
      }
    }

    const fullName = larkFieldToText(record.fields[fields.fullName])
    const phone = normalizePhone(larkFieldToText(record.fields[fields.phone]))

    if (!fullName) {
      skipped.push({ recordId: record.record_id, reason: "thiếu họ tên" })
      continue
    }
    if (phone.length < 9) {
      skipped.push({ recordId: record.record_id, reason: `số điện thoại không hợp lệ (${phone || "trống"})` })
      continue
    }
    // Two Lark rows sharing a phone would upsert over each other; keeping the
    // first and reporting the rest makes the duplicate visible in the base.
    if (seenPhones.has(phone)) {
      skipped.push({ recordId: record.record_id, reason: `trùng số điện thoại ${phone}` })
      continue
    }
    seenPhones.add(phone)
    students.push({ fullName, phone, larkRecordId: record.record_id })
  }

  return { students, skipped, filteredOut }
}
