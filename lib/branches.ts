// The branch shown when a visitor hasn't picked one via ?branch= yet, and the
// one BranchTabs lists first. A stable `code`, not a display name — names can
// be edited by an admin without breaking either.
const DEFAULT_BRANCH_CODE = "hoang-gia"

export function resolveActiveBranchId(
  branches: { id: string; code: string }[],
  branchParam: string | string[] | undefined
): string | undefined {
  if (typeof branchParam === "string") return branchParam
  return branches.find((b) => b.code === DEFAULT_BRANCH_CODE)?.id ?? branches[0]?.id
}

/** Puts the default branch first; every other branch keeps its existing relative order. */
export function sortBranchesDefaultFirst<T extends { code: string }>(branches: T[]): T[] {
  return [...branches].sort((a, b) => {
    const aIsDefault = a.code === DEFAULT_BRANCH_CODE
    const bIsDefault = b.code === DEFAULT_BRANCH_CODE
    if (aIsDefault === bIsDefault) return 0
    return aIsDefault ? -1 : 1
  })
}
