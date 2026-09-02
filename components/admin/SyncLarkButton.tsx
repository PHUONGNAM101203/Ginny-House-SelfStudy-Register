"use client"

import { useState } from "react"
import { toast } from "sonner"
import { RefreshCwIcon } from "lucide-react"
import { syncStudentsFromLarkAction } from "@/actions/lark"
import { Button } from "@/components/ui/button"

/**
 * On-demand version of the hourly Lark cron, for when an admin has just
 * edited the base and doesn't want to wait for the next sweep.
 */
export function SyncLarkButton() {
  const [syncing, setSyncing] = useState(false)

  async function sync() {
    setSyncing(true)
    const result = await syncStudentsFromLarkAction()
    setSyncing(false)
    if (!result.ok) return toast.error(result.error)

    const { upserted, skipped } = result.data
    // Skipped rows are a data problem in the base itself (blank phone,
    // duplicate number) that only someone looking at Lark can fix, so they
    // get surfaced rather than swallowed into a bare success.
    if (skipped.length > 0) {
      toast.warning(`Đã đồng bộ ${upserted} học sinh · bỏ qua ${skipped.length} dòng`, {
        description: skipped.slice(0, 3).map((s) => s.reason).join(" · "),
      })
      return
    }
    toast.success(`Đã đồng bộ ${upserted} học sinh từ Lark`)
  }

  return (
    <Button variant="outline" className="w-fit" onClick={sync} disabled={syncing}>
      <RefreshCwIcon className={syncing ? "animate-spin motion-reduce:animate-none" : undefined} />
      {syncing ? "Đang đồng bộ..." : "Đồng bộ từ Lark"}
    </Button>
  )
}
