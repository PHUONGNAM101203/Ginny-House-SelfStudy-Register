/**
 * Folds a Vietnamese string down to plain lowercase ASCII for searching, so
 * "Nguyễn Văn A", "nguyen van a" and "NGUYEN VAN A" all compare equal.
 *
 * NFD splits a letter from its accent so the combining marks can be stripped,
 * but đ/Đ is a distinct letter rather than d + a combining mark, so it has to
 * be replaced by hand — miss that and "hoang duc" never finds "Hoàng Đức".
 *
 * Mirrors what search_students does in Postgres with unaccent() (migration
 * 0021); this is the client-side half, for filtering a list already in hand.
 */
export function foldVietnamese(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
}

/** True when every whitespace-separated term appears somewhere in the haystack. */
export function matchesAllTerms(haystack: string, query: string): boolean {
  const folded = foldVietnamese(haystack)
  const terms = foldVietnamese(query).split(/\s+/).filter(Boolean)
  return terms.every((term) => folded.includes(term))
}
