import { createPublicClient } from "@/lib/supabase/public"
import { getWeekDates } from "@/lib/week"
import { format } from "date-fns"

export type Desk = { id: string; label: string }
export type RegistrationRow = { id: string; deskId: string; date: string; startTime: string; endTime: string; studentName: string }
export type SlotLock = { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }

export async function getScheduleData(branchId: string, weekMonday: Date) {
  const supabase = createPublicClient()
  const dates = getWeekDates(weekMonday)
  const from = format(dates[0], "yyyy-MM-dd")
  const to = format(dates[6], "yyyy-MM-dd")

  const [{ data: desks }, { data: registrations }, { data: locks }] = await Promise.all([
    supabase.from("desks").select("id, label").eq("branch_id", branchId).eq("active", true).order("label"),
    supabase
      .from("registrations")
      .select("id, desk_id, date, start_time, end_time, student_name")
      .eq("branch_id", branchId)
      .eq("status", "active")
      .gte("date", from)
      .lte("date", to),
    supabase.from("slot_locks").select("desk_id, day_of_week, start_time, end_time").eq("branch_id", branchId).eq("active", true),
  ])

  return {
    desks: (desks ?? []) as Desk[],
    registrations: (registrations ?? []).map((r) => ({
      id: r.id, deskId: r.desk_id, date: r.date, startTime: r.start_time, endTime: r.end_time, studentName: r.student_name,
    })) as RegistrationRow[],
    locks: (locks ?? []).map((l) => ({
      deskId: l.desk_id, dayOfWeek: l.day_of_week, startTime: l.start_time, endTime: l.end_time,
    })) as SlotLock[],
  }
}

export async function getBranches() {
  const supabase = createPublicClient()
  const { data } = await supabase.from("branches").select("id, code, name").order("name")
  return data ?? []
}
