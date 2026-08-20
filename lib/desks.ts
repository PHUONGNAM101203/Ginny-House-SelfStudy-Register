// Desk labels are free text ("Chỗ 1" … "Chỗ 10", and whatever an admin types
// in BranchDeskManager), but they were ordered by Postgres/`order("label")`,
// which is a plain lexicographic sort: "Chỗ 10" < "Chỗ 2" because '1' < '2'.
// That surfaced directly in the schedule grid, where the desk columns read
// 1, 10, 2, 3, … — reported by the user from a screenshot.
//
// Sorting is done in TS rather than in SQL on purpose: the numeric part is not
// a column, and adding a computed/expression index just to order a list that
// is at most a few dozen rows per branch is not worth the migration.
//
// Intl.Collator with `numeric` does the whole job, and — unlike a hand-rolled
// "split off the trailing digits" comparator — it is guaranteed transitive.
// A hand-rolled version was tried first and was not: with a mixed family like
// "Chỗ 9" / "Chỗ 10" / "Chỗ 10b" it compared 9 < 10 and 10 < 10b but 9 > 10b,
// which makes Array.sort's output implementation-defined.
const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "variant" })

/**
 * Compare two desk labels, ordering embedded numbers numerically.
 * "Chỗ 2" < "Chỗ 10", and non-numeric labels fall back to Vietnamese collation.
 */
export function compareDeskLabels(a: string, b: string): number {
  return collator.compare(a, b)
}

/**
 * Return a new array of desks ordered by {@link compareDeskLabels}.
 * Never mutates the input (callers pass arrays straight out of Supabase).
 */
export function sortDesks<T extends { label: string }>(desks: readonly T[]): T[] {
  return [...desks].sort((a, b) => compareDeskLabels(a.label, b.label))
}
