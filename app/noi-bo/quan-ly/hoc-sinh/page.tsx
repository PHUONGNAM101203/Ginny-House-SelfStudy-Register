import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { StudentTable } from "@/components/admin/StudentTable"

export default async function StudentsPage() {
  await requireAdmin()
  const supabase = await createServerClient()
  const { data: students } = await supabase.from("students").select("id, full_name, phone, created_at").order("full_name")

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Học sinh</h1>
      <StudentTable students={students ?? []} />
    </div>
  )
}
