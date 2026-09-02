"use server"

import { revalidatePath, refresh } from "next/cache"
import { requireAdmin } from "@/lib/auth"
import { syncStudentsFromLark, type LarkSyncResult } from "@/lib/lark/sync"
import type { ActionResult } from "@/types"

/**
 * The same sync the hourly cron runs, on demand — so an admin who just
 * edited the base doesn't have to wait up to an hour to see it here.
 */
export async function syncStudentsFromLarkAction(): Promise<ActionResult<LarkSyncResult>> {
  await requireAdmin()
  try {
    const result = await syncStudentsFromLark()
    revalidatePath("/noi-bo/quan-ly/hoc-sinh")
    refresh()
    return { ok: true, data: result }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Đồng bộ Lark thất bại" }
  }
}
