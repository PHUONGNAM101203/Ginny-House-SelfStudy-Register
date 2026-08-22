"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { reviewRegistrationChangeAction } from "@/actions/registrations"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export type ChangeRequestRow = {
  id: string
  kind: "cancel" | "reschedule"
  requestedByName: string
  requestedByPhone: string
  reason: string | null
  deskLabel: string
  date: string
  startTime: string
  endTime: string
  studentName: string
  className: string | null
  newDeskLabel: string | null
  newDate: string | null
  newStartTime: string | null
  newEndTime: string | null
}

/** Admin's queue for guest-submitted "phiếu xin xoá + đổi lịch" requests (see migration 0005). */
export function ChangeRequestTable({ rows }: { rows: ChangeRequestRow[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function review(id: string, approve: boolean) {
    setPendingId(id)
    const result = await reviewRegistrationChangeAction({ requestId: id, approve })
    setPendingId(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(approve ? "Đã duyệt yêu cầu" : "Đã từ chối yêu cầu")
    router.refresh()
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Không có yêu cầu nào đang chờ duyệt.</p>
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Loại</TableHead>
            <TableHead>Lịch hiện tại</TableHead>
            <TableHead>Học sinh / Lớp</TableHead>
            <TableHead>Người gửi</TableHead>
            <TableHead>Lý do</TableHead>
            <TableHead>Đổi sang</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Badge variant={r.kind === "cancel" ? "destructive" : "secondary"}>
                  {r.kind === "cancel" ? "Xin huỷ" : "Xin đổi lịch"}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">{r.deskLabel} · {r.date} · {r.startTime}-{r.endTime}</TableCell>
              <TableCell>{r.studentName}{r.className ? ` · ${r.className}` : ""}</TableCell>
              <TableCell className="whitespace-nowrap">{r.requestedByName} · {r.requestedByPhone}</TableCell>
              <TableCell className="max-w-48 truncate" title={r.reason ?? ""}>{r.reason ?? "—"}</TableCell>
              <TableCell className="whitespace-nowrap">
                {r.newDeskLabel ? `${r.newDeskLabel} · ${r.newDate} · ${r.newStartTime}-${r.newEndTime}` : "Để admin sắp xếp"}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button size="sm" disabled={pendingId === r.id} onClick={() => review(r.id, true)}>Duyệt</Button>
                  <Button size="sm" variant="outline" disabled={pendingId === r.id} onClick={() => review(r.id, false)}>Từ chối</Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
