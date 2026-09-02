import { createAdminClient } from "@/lib/supabase/admin"
import { readLarkConfig } from "@/lib/lark/config"
import { getTenantAccessToken, listBitableRecords } from "@/lib/lark/client"
import { mapLarkRecords } from "@/lib/lark/map"

export type LarkSyncResult = {
  fetched: number
  upserted: number
  /** Rows the status allowlist excluded — leads, alumni, students who left. */
  filteredOut: number
  /** Students archived because they dropped out of the allowed statuses. */
  archived: number
  skipped: { recordId: string; reason: string }[]
}

/**
 * Pulls the student list out of the Lark Base and upserts it into `students`.
 *
 * Deliberately never deletes: `students` is the parent of registrations and
 * recurring_registrations through ON DELETE CASCADE, so removing a row that
 * disappeared from Lark would silently take that student's entire booking
 * history with it. Removals stay a manual decision on the Học sinh page.
 *
 * Uses the service-role client because there is no signed-in user on a cron
 * run — which also rules out the import_students_admin RPC, whose is_admin()
 * check reads auth.uid().
 */
export async function syncStudentsFromLark(): Promise<LarkSyncResult> {
  const config = readLarkConfig()
  if (!config) {
    throw new Error(
      "Chưa cấu hình Lark — cần LARK_APP_ID, LARK_APP_SECRET, LARK_BASE_APP_TOKEN, LARK_BASE_TABLE_ID"
    )
  }

  const token = await getTenantAccessToken(config)
  const records = await listBitableRecords(config, token)
  const { students, skipped, filteredOut } = mapLarkRecords(
    records,
    config.fieldNames,
    config.statusAllowlist
  )

  if (students.length === 0) {
    return { fetched: records.length, upserted: 0, filteredOut, archived: 0, skipped }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("students").upsert(
    students.map((s) => ({
      full_name: s.fullName,
      phone: s.phone,
      lark_record_id: s.larkRecordId,
      class_name: s.className,
      active: true,
    })),
    { onConflict: "phone" }
  )
  if (error) throw new Error(`Không ghi được vào students: ${error.message}`)

  const archived = await archiveStudentsNoLongerInLark(supabase, students.map((s) => s.larkRecordId))

  return { fetched: records.length, upserted: students.length, filteredOut, archived, skipped }
}

/**
 * A student who moves to "Đã nghỉ" (or any status off the allowlist) simply
 * stops being upserted, so without this they would linger on the roster for
 * ever. Archiving rather than deleting keeps their booking history — same
 * reasoning as the manual "Ngừng hoạt động" button.
 *
 * Scoped to rows that carry a lark_record_id: students added by hand in the
 * app are nobody's business but the admin's, and must not be archived just
 * for being absent from a Base they were never in.
 *
 * For students that DO come from Lark, the Base is treated as authoritative —
 * the upsert above sets active back to true when someone returns to an
 * allowed status. The consequence worth knowing: manually archiving a
 * student who is still "Đang học" in Lark gets undone by the next sync. Fix
 * that in Lark, not here.
 *
 * Read-then-update by id rather than a `not.in` filter string, matching how
 * the dashboard resolves its notifications — a thousand ids in a URL filter
 * is not something to rely on.
 */
async function archiveStudentsNoLongerInLark(
  supabase: ReturnType<typeof createAdminClient>,
  keepRecordIds: string[]
): Promise<number> {
  const { data: existing } = await supabase
    .from("students")
    .select("id, lark_record_id")
    .not("lark_record_id", "is", null)
    .eq("active", true)

  const keep = new Set(keepRecordIds)
  const staleIds = (existing ?? [])
    .filter((row) => row.lark_record_id && !keep.has(row.lark_record_id))
    .map((row) => row.id)

  if (staleIds.length === 0) return 0

  const { error } = await supabase.from("students").update({ active: false }).in("id", staleIds)
  if (error) throw new Error(`Không cập nhật được trạng thái học sinh: ${error.message}`)
  return staleIds.length
}
