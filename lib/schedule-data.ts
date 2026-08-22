import { createPublicClient } from "@/lib/supabase/public"
import { getMondayOfWeek, getWeekDates } from "@/lib/week"
import { sortDesks } from "@/lib/desks"
import { sortBranchesDefaultFirst } from "@/lib/branches"
import { parseYmd, vietnamToday } from "@/lib/vn-date"
import { addWeeks, format } from "date-fns"

export type Desk = { id: string; label: string }
export type RegistrationRow = { id: string; deskId: string; date: string; startTime: string; endTime: string; studentName: string }
export type SlotLock = { deskId: string | null; dayOfWeek: number; startTime: string; endTime: string }

export async function getScheduleData(branchId: string, weekMonday: Date) {
  const supabase = createPublicClient()
  const dates = getWeekDates(weekMonday)
  const from = format(dates[0], "yyyy-MM-dd")
  const to = format(dates[6], "yyyy-MM-dd")

  const [{ data: desks }, { data: registrations }, { data: locks }] = await Promise.all([
    // No .order() here: Postgres would sort "Chỗ 10" before "Chỗ 2". The real
    // ordering is applied below with sortDesks (see lib/desks.ts).
    supabase.from("desks").select("id, label").eq("branch_id", branchId).eq("active", true),
    supabase
      .from("registrations")
      .select("id, desk_id, date, start_time, end_time, student_name")
      .eq("branch_id", branchId)
      .eq("status", "active")
      .gte("date", from)
      .lte("date", to)
      // .limit(10000) matches supabase/config.toml's raised `max_rows`: explicit and intentional
      // rather than silently truncating at PostgREST's default (which could render a booked slot
      // as free). TODO: replace with SQL-side aggregation (view/RPC) once data volume grows.
      .limit(10000),
    supabase.from("slot_locks").select("desk_id, day_of_week, start_time, end_time").eq("branch_id", branchId).eq("active", true),
  ])

  return {
    // Desk order is the grid's column order, so it has to be numeric.
    desks: sortDesks((desks ?? []) as Desk[]),
    registrations: (registrations ?? []).map((r) => ({
      id: r.id,
      deskId: r.desk_id,
      date: r.date,
      startTime: toHm(r.start_time),
      endTime: toHm(r.end_time),
      studentName: r.student_name,
    })) as RegistrationRow[],
    locks: (locks ?? []).map((l) => ({
      deskId: l.desk_id,
      dayOfWeek: l.day_of_week,
      startTime: toHm(l.start_time),
      endTime: toHm(l.end_time),
    })) as SlotLock[],
  }
}

// Postgres `time` columns serialize over PostgREST as "HH:MM:SS" (or "HH:MM:SS.ffffff" if a value
// ever carries fractional seconds). The rest of the TS layer works with plain "HH:MM" strings
// (see lib/time-slots.ts), so normalize at this boundary before returning to callers.
function toHm(value: string): string {
  const [h, m] = value.split(":")
  return `${h}:${m}`
}

// How far ahead of the current week to auto-materialize recurring bookings.
// This is deliberately independent of MAX_YEARS_FROM_TODAY in
// lib/schedule-params.ts, which only bounds how far a visitor may *look*
// (navigate the `?day=` picker). Materializing is a *write* — the RPC below
// is security-definer and anon-callable — and the recurring-booking feature
// only needs to keep the near-term weeks filled in as time passes; there is
// no product reason to pre-insert real registration rows years in advance.
// Without its own bound, a visitor could walk `?day=` across every future
// week up to the 2-year display clamp and force-insert rows for all of them.
const MAX_MATERIALIZE_WEEKS_AHEAD = 8

export async function materializeWeek(weekMonday: Date) {
  // Guard against retroactively fabricating attendance. Both the guest page and
  // /noi-bo/lich call this for whatever week the URL asks for, so browsing back
  // to any past week used to insert source='recurring_auto' rows dated in the
  // past — sessions that never happened — which then poison the dashboard's
  // trend chart and frequency ranking. Materializing is only ever meaningful
  // for the current week onward.
  const currentMonday = getMondayOfWeek(parseYmd(vietnamToday()))
  const maxMonday = addWeeks(currentMonday, MAX_MATERIALIZE_WEEKS_AHEAD)
  const requested = format(weekMonday, "yyyy-MM-dd")
  const currentWeek = format(currentMonday, "yyyy-MM-dd")
  const maxWeek = format(maxMonday, "yyyy-MM-dd")
  if (requested < currentWeek || requested > maxWeek) return

  const supabase = createPublicClient()
  await supabase.rpc("materialize_recurring_registrations", {
    p_week_start: requested,
  })
}

export async function getBranches() {
  const supabase = createPublicClient()
  const { data } = await supabase.from("branches").select("id, code, name").order("name")
  return sortBranchesDefaultFirst(data ?? [])
}
