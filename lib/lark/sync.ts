import { createAdminClient } from "@/lib/supabase/admin"
import { readLarkConfig } from "@/lib/lark/config"
import { getTenantAccessToken, listBitableRecords } from "@/lib/lark/client"
import { mapLarkRecords } from "@/lib/lark/map"

export type LarkSyncResult = {
  fetched: number
  upserted: number
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
  const { students, skipped } = mapLarkRecords(records, config.fieldNames)

  if (students.length === 0) {
    return { fetched: records.length, upserted: 0, skipped }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from("students").upsert(
    students.map((s) => ({ full_name: s.fullName, phone: s.phone, lark_record_id: s.larkRecordId })),
    { onConflict: "phone" }
  )
  if (error) throw new Error(`Không ghi được vào students: ${error.message}`)

  return { fetched: records.length, upserted: students.length, skipped }
}
