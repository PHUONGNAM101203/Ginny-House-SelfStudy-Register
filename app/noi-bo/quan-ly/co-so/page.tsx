import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { BranchDeskManager } from "@/components/admin/BranchDeskManager"

export default async function BranchDeskPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const [{ data: branches }, { data: desks }] = await Promise.all([
    supabase.from("branches").select("id, code, name").order("name"),
    supabase.from("desks").select("id, branch_id, label, active").order("label"),
  ])

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Quản lý cơ sở & chỗ ngồi</h1>
      <BranchDeskManager branches={branches ?? []} desks={desks ?? []} />
    </div>
  )
}
