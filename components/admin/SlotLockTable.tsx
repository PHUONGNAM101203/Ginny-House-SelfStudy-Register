"use client"

import { toast } from "sonner"
import { deactivateSlotLockAction } from "@/actions/slot-locks"
import { DAY_LABELS } from "@/lib/validations/slot-lock"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Lock = { id: string; branch_name: string; desk_label: string | null; day_of_week: number; start_time: string; end_time: string; reason: string | null }

export function SlotLockTable({ locks }: { locks: Lock[] }) {
  async function deactivate(id: string) {
    const result = await deactivateSlotLockAction(id)
    if (!result.ok) toast.error(result.error)
    else toast.success("Đã mở lại")
  }

  return (
    <Table>
      <TableHeader>
        <TableRow><TableHead>Cơ sở</TableHead><TableHead>Chỗ</TableHead><TableHead>Thứ</TableHead><TableHead>Giờ</TableHead><TableHead>Lý do</TableHead><TableHead /></TableRow>
      </TableHeader>
      <TableBody>
        {locks.map((l) => (
          <TableRow key={l.id}>
            <TableCell>{l.branch_name}</TableCell>
            <TableCell>{l.desk_label ?? "Cả cơ sở"}</TableCell>
            <TableCell>{DAY_LABELS[l.day_of_week]}</TableCell>
            <TableCell>{l.start_time}-{l.end_time}</TableCell>
            <TableCell>{l.reason ?? "—"}</TableCell>
            <TableCell><Button size="sm" variant="outline" onClick={() => deactivate(l.id)}>Mở lại</Button></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
