"use client"

import { useState } from "react"
import { toast } from "sonner"
import { deactivateSlotLockAction, endSlotLockAfterThisWeekAction } from "@/actions/slot-locks"
import { cancelRegistrationAsAdminAction } from "@/actions/registrations"
import { describeLockScope, lockDayLabel } from "@/lib/slot-locks"
import { Button } from "@/components/ui/button"
import { PagedCardGrid } from "@/components/admin/PagedCardGrid"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Lock = {
  id: string
  branch_id: string
  branch_name: string
  desk_label: string | null
  day_of_week: number | null
  start_time: string
  end_time: string
  effective_from: string | null
  effective_to: string | null
  reason: string | null
}

/** A booking that falls inside a lock's window — listed, never auto-cancelled. */
export type LockConflict = {
  id: string
  /** "yyyy-MM-dd" */
  date: string
  startTime: string
  endTime: string
  deskLabel: string
  studentName: string | null
  className: string | null
  phone: string | null
}

type Branch = { id: string; name: string }

/** Postgres hands times back as HH:MM:SS; the seconds are always :00 here. */
function hhmm(time: string) {
  return time.slice(0, 5)
}

/** "2026-09-19" → "19/09". */
function dm(date: string) {
  const [, month, day] = date.split("-")
  return `${day}/${month}`
}

function ConflictList({ conflicts }: { conflicts: LockConflict[] }) {
  const [cancelling, setCancelling] = useState<string | null>(null)

  async function cancel(id: string) {
    setCancelling(id)
    const result = await cancelRegistrationAsAdminAction({ registrationId: id })
    setCancelling(null)
    if (!result.ok) toast.error(result.error)
    else toast.success("Đã huỷ lịch của bạn ấy")
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gold/40 bg-gold/10 p-2">
      <p className="text-xs font-medium text-gold-foreground">
        {conflicts.length} lịch đã đăng ký nằm trong khung khoá này. Khoá không tự huỷ lịch của các bạn ấy — huỷ từng
        bạn ở đây nếu cần, và nhớ báo cho bạn ấy.
      </p>
      <ul className="flex flex-col gap-1">
        {conflicts.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-md bg-card px-2 py-1.5 text-xs">
            <span className="min-w-0 truncate">
              <span className="tabular-nums">
                {dm(c.date)} · {c.startTime}–{c.endTime}
              </span>{" "}
              · {c.studentName ?? "—"}
              {c.className && ` · ${c.className}`}
              {c.phone && <span className="text-muted-foreground"> · {c.phone}</span>}
              <span className="text-muted-foreground"> · {c.deskLabel}</span>
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="shrink-0"
              disabled={cancelling === c.id}
              onClick={() => cancel(c.id)}
            >
              {cancelling === c.id ? "Đang huỷ..." : "Huỷ"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SlotLockTable({
  locks,
  branches,
  conflictsByLock,
}: {
  locks: Lock[]
  branches: Branch[]
  conflictsByLock: Record<string, LockConflict[]>
}) {
  async function endAfterThisWeek(id: string) {
    const result = await endSlotLockAfterThisWeekAction(id)
    if (!result.ok) return toast.error(result.error)
    toast.success(`Tuần này vẫn khoá, từ tuần sau mở (hết hiệu lực ${dm(result.data.effectiveTo)})`)
  }

  async function deactivate(id: string) {
    const result = await deactivateSlotLockAction(id)
    if (!result.ok) toast.error(result.error)
    else toast.success("Đã gỡ khoá, áp dụng cho cả tuần này")
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
            card={(l) => {
              const scope = { dayOfWeek: l.day_of_week, effectiveFrom: l.effective_from, effectiveTo: l.effective_to }
              const repeats = l.day_of_week !== null
              const conflicts = conflictsByLock[l.id] ?? []
              return (
                <div key={l.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {lockDayLabel(scope)} · {hhmm(l.start_time)}–{hhmm(l.end_time)}
                    </p>
                    {/* In words, because "lặp lại hằng tuần" and "chỉ ngày
                        19/09" look identical as a row of columns and mean very
                        different things to whoever is about to remove it. */}
                    <p className="truncate text-xs font-medium text-muted-foreground">{describeLockScope(scope)}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.desk_label ?? "Cả cơ sở"}</p>
                  </div>
                  {l.reason && <p className="text-xs text-muted-foreground">Lý do: {l.reason}</p>}

                  {conflicts.length > 0 && <ConflictList conflicts={conflicts} />}

                  <div className="flex flex-wrap gap-2">
                    {/* Only a repeating lock has a "next week" to open up; a
                        one-off already stops on its own. */}
                    {repeats && (
                      <Button size="sm" variant="outline" onClick={() => endAfterThisWeek(l.id)}>
                        Gỡ khoá từ tuần sau
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => deactivate(l.id)}>
                      Gỡ khoá ngay (cả tuần này)
                    </Button>
                  </div>
                </div>
              )
            }}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
