"use client"

import { toast } from "sonner"
import { deactivateSlotLockAction } from "@/actions/slot-locks"
import { DAY_LABELS } from "@/lib/validations/slot-lock"
import { Button } from "@/components/ui/button"
import { PagedCardGrid } from "@/components/admin/PagedCardGrid"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Lock = {
  id: string
  branch_id: string
  branch_name: string
  desk_label: string | null
  day_of_week: number
  start_time: string
  end_time: string
  reason: string | null
}

type Branch = { id: string; name: string }

/** Postgres hands times back as HH:MM:SS; the seconds are always :00 here. */
function hhmm(time: string) {
  return time.slice(0, 5)
}

export function SlotLockTable({ locks, branches }: { locks: Lock[]; branches: Branch[] }) {
  async function deactivate(id: string) {
    const result = await deactivateSlotLockAction(id)
    if (!result.ok) toast.error(result.error)
    else toast.success("Đã mở lại")
  }

  if (branches.length === 0) {
    return <p className="text-sm text-muted-foreground">Chưa có cơ sở nào.</p>
  }

  // Same reasoning as the desk list on /quan-ly/co-so: one flat table mixing
  // both cơ sở meant the "Cơ sở" column repeated itself down every row while
  // the list itself ran long. Tabbing by cơ sở drops the column and shows
  // only the cơ sở being looked at.
  const locksByBranch = new Map<string, Lock[]>(branches.map((b) => [b.id, []]))
  for (const lock of locks) locksByBranch.get(lock.branch_id)?.push(lock)

  return (
    <Tabs defaultValue={branches[0].id}>
      <TabsList className="w-full">
        {branches.map((b) => (
          <TabsTrigger key={b.id} value={b.id}>
            {b.name}
            <span className="text-xs text-muted-foreground">({locksByBranch.get(b.id)?.length ?? 0})</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {branches.map((b) => (
        <TabsContent key={b.id} value={b.id} className="mt-4">
          <PagedCardGrid
            items={locksByBranch.get(b.id) ?? []}
            resetKey={b.id}
            emptyMessage="Cơ sở này không có khoá lịch nào."
            card={(l) => (
              <div key={l.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {DAY_LABELS[l.day_of_week]} · {hhmm(l.start_time)}-{hhmm(l.end_time)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{l.desk_label ?? "Cả cơ sở"}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => deactivate(l.id)}>
                    Mở lại
                  </Button>
                </div>
                {l.reason && <p className="text-xs text-muted-foreground">Lý do: {l.reason}</p>}
              </div>
            )}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
