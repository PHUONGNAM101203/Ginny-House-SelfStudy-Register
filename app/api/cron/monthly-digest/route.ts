import { NextResponse } from "next/server"
import { endOfMonth, startOfMonth, subMonths } from "date-fns"
import { createAdminClient } from "@/lib/supabase/admin"
import { buildMonthlyDigest, type MonthlyDigestStats } from "@/lib/monthly-digest"
import { sendPushToRole } from "@/lib/push/send"
import { parseYmd, toYmd, vietnamToday } from "@/lib/vn-date"

/** "HH:MM" or "HH:MM:SS" → minutes since midnight. */
function minutesOf(time: string): number {
  const [h, m] = time.split(":")
  return Number(h) * 60 + Number(m)
}

/**
 * End-of-month wrap-up, posted into the notification bell at 22:00 Vietnam on
 * the last day of the month, alongside the Sunday weekly digest.
 *
 * Cron has no "last day of the month" expression, so the schedule in
 * vercel.json fires on days 28-31 and this route decides: on any of those
 * days that is not actually the month's last, it returns without writing
 * anything. That costs at most three no-op invocations a month and keeps the
 * rule in one place instead of splitting it across twelve cron entries.
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

  // ?month=YYYY-MM re-runs a given month by hand — for a cron run that was
  // missed, or to regenerate one after a correction. Same CRON_SECRET gate as
  // the scheduled run, and the upsert keeps it idempotent.
  const requestedMonth = new URL(request.url).searchParams.get("month")
  if (requestedMonth !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 })
  }

  // Vietnam's own date, not the server's — at 22:00 ICT it is still the
  // previous day in UTC, which would summarise the wrong month on the 1st.
  const today = parseYmd(vietnamToday())
  const monthStart = startOfMonth(requestedMonth ? parseYmd(`${requestedMonth}-01`) : today)
  const monthEnd = endOfMonth(monthStart)
  // Cron fires on the 28th through the 31st (see vercel.json); only the day
  // that is actually the month's last writes anything.
  if (!requestedMonth && toYmd(today) !== toYmd(monthEnd)) {
    return NextResponse.json({ ok: true, skipped: "not the last day of the month", today: toYmd(today) })
  }

  const from = toYmd(monthStart)
  const to = toYmd(monthEnd)
  const previousFrom = toYmd(startOfMonth(subMonths(monthStart, 1)))
  const previousTo = toYmd(endOfMonth(subMonths(monthStart, 1)))

  const supabase = createAdminClient()
  const [branchesRes, activeRes, cancelledRes, requestsRes, studentsRes, recurringRes, previousRes] = await Promise.all([
    supabase.from("branches").select("id, name"),
    supabase
      .from("registrations")
      .select("branch_id, student_id, date, start_time, end_time")
      .eq("status", "active")
      .gte("date", from)
      .lte("date", to)
      // Same explicit ceiling as getScheduleData: a silently truncated page
      // would under-report the month rather than fail loudly.
      .limit(10000),
    supabase.from("registrations").select("id").eq("status", "cancelled").gte("date", from).lte("date", to).limit(10000),
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
    supabase
      .from("registrations")
      .select("id")
      .eq("status", "active")
      .gte("date", previousFrom)
      .lte("date", previousTo)
      .limit(10000),
  ])

  const branchNameById = new Map((branchesRes.data ?? []).map((b) => [b.id, b.name]))
  const registrationsByBranch: Record<string, number> = {}
  for (const name of branchNameById.values()) registrationsByBranch[name] = 0

  const active = activeRes.data ?? []
  const students = new Set<string>()
  const byDate = new Map<string, number>()
  let totalMinutes = 0
  for (const row of active) {
    const name = branchNameById.get(row.branch_id)
    if (name) registrationsByBranch[name] += 1
    if (row.student_id) students.add(row.student_id)
    byDate.set(row.date, (byDate.get(row.date) ?? 0) + 1)
    totalMinutes += minutesOf(row.end_time) - minutesOf(row.start_time)
  }

  // Ties break on the earlier date, so the answer is stable rather than
  // whichever row the database happened to return first.
  let busiestDate: string | null = null
  let busiestCount = 0
  for (const [date, count] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    if (count > busiestCount) {
      busiestDate = date
      busiestCount = count
    }
  }

  const requests = requestsRes.data ?? []
  const recurring = recurringRes.data ?? []

  const stats: MonthlyDigestStats = {
    registrationsByBranch,
    cancelled: cancelledRes.data?.length ?? 0,
    changeRequestsApproved: requests.filter((r) => r.status === "approved").length,
    changeRequestsPending: requests.filter((r) => r.status === "pending").length,
    newStudents: studentsRes.data?.length ?? 0,
    activeRecurring: recurring.filter((r) => r.student_id !== null).length,
    vacantRecurring: recurring.filter((r) => r.student_id === null).length,
    distinctStudents: students.size,
    totalHours: Math.round(totalMinutes / 60),
    busiestDate,
    busiestCount,
    previousTotal: previousRes.data?.length ?? 0,
  }

  const digest = buildMonthlyDigest(monthStart, stats)
  const { error } = await supabase.from("notifications").upsert(
    {
      type: "monthly_digest",
      title: digest.title,
      body: digest.body,
      link: "/noi-bo/dashboard",
      target_role: null,
      dedupe_key: digest.dedupeKey,
    },
    { onConflict: "dedupe_key" }
  )

  if (error) {
    console.error("monthly digest failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Same reasoning as the weekly one: nobody is sitting in the app at 22:00
  // on the last of the month waiting for this, so it goes to the phone.
  await sendPushToRole(null, { title: digest.title, body: digest.body, link: "/noi-bo/dashboard" })

  return NextResponse.json({ ok: true, month: `${from}..${to}`, ...stats })
}
