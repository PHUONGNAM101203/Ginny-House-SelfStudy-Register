"use client"

import { toast } from "sonner"
import { deactivateRecurringRegistrationAction } from "@/actions/registrations"
import { DAY_LABELS } from "@/lib/validations/slot-lock"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ResponsiveList } from "@/components/admin/ResponsiveList"

export type RecurringRow = {
  id: string
  student_name: string
  class_name: string | null
  branch_name: string
  desk_label: string
  day_of_week: number
  start_time: string
  end_time: string
}

export function RecurringRegistrationTable({ rows }: { rows: RecurringRow[] }) {
  async function deactivate(id: string) {
    const result = await deactivateRecurringRegistrationAction(id)
    if (!result.ok) toast.error(result.error)
    else toast.success("Đã huỷ lịch cố định")
  }

  return (
    <ResponsiveList
      items={rows}
      emptyMessage="Chưa có lịch cố định nào đang áp dụng."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Học sinh</TableHead><TableHead>Lớp</TableHead><TableHead>Cơ sở</TableHead><TableHead>Chỗ</TableHead>
              <TableHead>Thứ</TableHead><TableHead>Giờ</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.student_name}</TableCell>
                <TableCell>{r.class_name ?? "—"}</TableCell>
                <TableCell>{r.branch_name}</TableCell>
                <TableCell>{r.desk_label}</TableCell>
                <TableCell>{DAY_LABELS[r.day_of_week]}</TableCell>
                <TableCell>{r.start_time}-{r.end_time}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => deactivate(r.id)}>Huỷ lịch cố định</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
      card={(r) => (
        <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{r.student_name}{r.class_name ? ` · ${r.class_name}` : ""}</p>
            <p className="truncate text-xs text-muted-foreground">{r.branch_name} · {r.desk_label}</p>
            <p className="truncate text-xs text-muted-foreground">{DAY_LABELS[r.day_of_week]} · {r.start_time}-{r.end_time}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => deactivate(r.id)}>Huỷ lịch cố định</Button>
        </div>
      )}
    />
  )
}
