// The branch shown when a visitor hasn't picked one via ?branch= yet.
// A stable `code`, not a display name — names can be edited by an admin
// without breaking which branch loads by default.
const DEFAULT_BRANCH_CODE = "hoang-gia"

export function resolveActiveBranchId(
  branches: { id: string; code: string }[],
  branchParam: string | string[] | undefined
): string | undefined {
  if (typeof branchParam === "string") return branchParam
  return branches.find((b) => b.code === DEFAULT_BRANCH_CODE)?.id ?? branches[0]?.id
}
