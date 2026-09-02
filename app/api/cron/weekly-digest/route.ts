import { NextResponse } from "next/server"
import { addDays } from "date-fns"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildWeeklyDigest, type WeeklyDigestStats } from "@/lib/weekly-digest"
import { getMondayOfWeek } from "@/lib/week"
import { parseYmd, toYmd, vietnamToday } from "@/lib/vn-date"

/**
 * Sunday 22:00 Vietnam (15:00 UTC — see the cron entry in vercel.json)
 * wrap-up of the week that's ending, posted into the notification bell.
 *
 * Runs on the service-role client because there is no signed-in user on a
 * cron invocation, so nothing would pass the notifications RLS policies.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  // Fail closed: an unauthenticated writer of admin-visible notifications is
  // not something to leave open just because the env var is missing.
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const monday = getMondayOfWeek(parseYmd(vietnamToday()))
  const sunday = addDays(monday, 6)
  const from = toYmd(monday)
  const to = toYmd(sunday)

  const supabase = createAdminClient()
  const [branchesRes, activeRes, cancelledRes, requestsRes, studentsRes, recurringRes] = await Promise.all([
    supabase.from("branches").select("id, name"),
    supabase.from("registrations").select("branch_id").eq("status", "active").gte("date", from).lte("date", to),
    supabase.from("registrations").select("id").eq("status", "cancelled").gte("date", from).lte("date", to),
    supabase
      .from("registration_change_requests")
      .select("status")
      .gte("created_at", `${from}T00:00:00+07:00`)
      .lte("created_at", `${to}T23:59:59+07:00`),
    supabase
      .from("students")
      .select("id")
      .gte("created_at", `${from}T00:00:00+07:00`)
      .lte("created_at", `${to}T23:59:59+07:00`),
    supabase.from("recurring_registrations").select("student_id").eq("active", true),
  ])

  const branchNameById = new Map((branchesRes.data ?? []).map((b) => [b.id, b.name]))
  const registrationsByBranch: Record<string, number> = {}
  for (const name of branchNameById.values()) registrationsByBranch[name] = 0
  for (const row of activeRes.data ?? []) {
    const name = branchNameById.get(row.branch_id)
    if (name) registrationsByBranch[name] += 1
  }

  const requests = requestsRes.data ?? []
  const recurring = recurringRes.data ?? []

  const stats: WeeklyDigestStats = {
    registrationsByBranch,
    cancelled: cancelledRes.data?.length ?? 0,
    changeRequestsApproved: requests.filter((r) => r.status === "approved").length,
    changeRequestsPending: requests.filter((r) => r.status === "pending").length,
    newStudents: studentsRes.data?.length ?? 0,
    // student_id only becomes nullable with the vacant-slot feature; until
    // then every active rule counts as claimed and vacant stays 0.
    activeRecurring: recurring.filter((r) => r.student_id !== null).length,
    vacantRecurring: recurring.filter((r) => r.student_id === null).length,
  }

  const digest = buildWeeklyDigest(monday, sunday, stats)
  const { error } = await supabase.from("notifications").upsert(
    {
      type: "weekly_digest",
      title: digest.title,
      body: digest.body,
      link: "/noi-bo/dashboard",
      target_role: null,
      dedupe_key: digest.dedupeKey,
    },
    { onConflict: "dedupe_key" }
  )

  if (error) {
    console.error("weekly digest failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, week: `${from}..${to}`, ...stats })
}
