import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { BranchDeskManager } from "@/components/admin/BranchDeskManager"
import { compareDeskLabels } from "@/lib/desks"

export default async function BranchDeskPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const [{ data: branches }, { data: desks }] = await Promise.all([
    supabase.from("branches").select("id, code, name").order("name"),
    // Ordering is done in TS, not SQL — "Chỗ 10" sorts before "Chỗ 2"
    // lexicographically (see lib/desks.ts).
    supabase.from("desks").select("id, branch_id, label, active"),
  ])

  const branchList = branches ?? []
  // The table lists every branch's desks in one flat body, so group by branch
  // first (in the same order the branch table above uses) and only then by
  // desk number — otherwise the two branches' "Chỗ 1"s interleave.
  const branchOrder = new Map(branchList.map((b, i) => [b.id, i]))
  // A desk whose branch is missing from the list (only possible if the branches
  // query errored) sorts last rather than silently jumping to the top.
  const branchRank = (id: string) => branchOrder.get(id) ?? Number.MAX_SAFE_INTEGER
  const orderedDesks = [...(desks ?? [])].sort(
    (a, b) => branchRank(a.branch_id) - branchRank(b.branch_id) || compareDeskLabels(a.label, b.label)
  )

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Quản lý cơ sở & chỗ ngồi</h1>
      <BranchDeskManager branches={branchList} desks={orderedDesks} />
    </div>
  )
}
