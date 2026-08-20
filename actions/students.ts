"use server"

import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"

export async function getStudentHistoryAction(studentId: string) {
  await requireAdmin()
  const supabase = await createServerClient()
  const { data } = await supabase
    .from("registrations")
    .select("date, start_time, end_time, status, source")
    .eq("student_id", studentId)
    .order("date", { ascending: false })
  return data ?? []
}
