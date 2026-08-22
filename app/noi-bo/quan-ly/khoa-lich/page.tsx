import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { SlotLockForm } from "@/components/admin/SlotLockForm"
import { SlotLockTable } from "@/components/admin/SlotLockTable"
import { sortDesks } from "@/lib/desks"
import { sortBranchesDefaultFirst } from "@/lib/branches"

export default async function SlotLockPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const [{ data: branches }, { data: desks }, { data: locks }] = await Promise.all([
    supabase.from("branches").select("id, code, name").order("name"),
    // Sorted in TS below, not by SQL — see lib/desks.ts ("Chỗ 10" vs "Chỗ 2").
    supabase.from("desks").select("id, branch_id, label"),
    supabase
      .from("slot_locks")
      .select("id, day_of_week, start_time, end_time, reason, branches(name), desks(label)")
      .eq("active", true),
  ])

  type LockRow = {
    id: string
    day_of_week: number
    start_time: string
    end_time: string
    reason: string | null
    branches: { name: string } | null
    desks: { label: string } | null
  }

  const rows = ((locks ?? []) as unknown as LockRow[]).map((l) => ({
    id: l.id, branch_name: l.branches?.name ?? "", desk_label: l.desks?.label ?? null,
    day_of_week: l.day_of_week, start_time: l.start_time, end_time: l.end_time, reason: l.reason,
  }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Khoá / mở lịch</h1>
      {/* SlotLockForm already narrows this list to the selected branch, so a
          plain desk-number sort is enough here. */}
      <SlotLockForm branches={sortBranchesDefaultFirst(branches ?? [])} desks={sortDesks(desks ?? [])} />
      <SlotLockTable locks={rows} />
    </div>
  )
}
