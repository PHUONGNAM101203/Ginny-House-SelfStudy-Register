import { requireProfile } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"
import { StaffChatPanel } from "@/components/chat/StaffChatPanel"

// Postgres `time` columns serialize as "HH:MM:SS" over PostgREST, but
// isChatWindowOpen expects "HH:MM" — same normalization every other page
// reading a raw time column already needs (see dashboard/page.tsx's own
// toHm). Without this, the extra ":00" makes the constructed date string
// invalid, which silently filters every row out of "open" sessions.
function toHm(value: string): string {
  const [h, m] = value.split(":")
  return `${h}:${m}`
}

// Not requireAdmin — both admin and quan_sinh can see/respond to chat,
// unlike the change-request review page which is admin-only.
export default async function ChatInboxPage() {
  await requireProfile()
  const supabase = await createServerClient()

  // Join thủ công trong TS thay vì PostgREST embed sâu — đúng quy ước đã
  // thiết lập ở trang co-so/yeu-cau-doi-lich (tránh embed-shape ambiguity).
  const { data: sessions } = await supabase.from("chat_sessions").select("id, registration_id, status").eq("status", "active")
  const registrationIds = (sessions ?? []).map((s) => s.registration_id)
  const { data: registrations } =
    registrationIds.length > 0
      ? await supabase.from("registrations").select("id, student_name, class_name, date, start_time, end_time").in("id", registrationIds)
      : { data: [] }

  const rows = (sessions ?? [])
    .map((s) => {
      const reg = (registrations ?? []).find((r) => r.id === s.registration_id)
      if (!reg) return null
      return { sessionId: s.id, ...reg, start_time: toHm(reg.start_time), end_time: toHm(reg.end_time) }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Chat với học sinh</h1>
      <StaffChatPanel rows={rows} />
    </div>
  )
}
