// The Excel sheet this app replaced had class codes typed inconsistently
// (case, spacing, dashes vs spaces) but always as a letter followed by three
// numbers, e.g. "L1-04-26". Normalizing whatever the guest typed to that
// canonical shape means "l1 4 26", "L1-04-26", and "l1-4-26" all end up as
// the same class, instead of silently creating near-duplicate class names.
export function normalizeClassName(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return trimmed

  const match = trimmed.toUpperCase().match(/^([A-Z]*)\D*(\d+)\D+(\d+)\D+(\d+)\D*$/)
  if (!match) return trimmed.toUpperCase()

  const [, prefix, first, second, third] = match
  const letter = prefix || "L"
  return `${letter}${first}-${second.padStart(2, "0")}-${third.padStart(2, "0")}`
}
