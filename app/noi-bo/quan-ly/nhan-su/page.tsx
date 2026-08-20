import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { StaffForm } from "@/components/admin/StaffForm"
import { StaffTable } from "@/components/admin/StaffTable"

export default async function StaffPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const { data: staff } = await supabase.from("profiles").select("id, full_name, role").order("full_name")

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Nhân sự</h1>
      <StaffForm />
      <StaffTable staff={staff ?? []} />
    </div>
  )
}
