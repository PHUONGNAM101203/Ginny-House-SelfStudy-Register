"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PencilIcon } from "lucide-react"
import { updateStaffAction, deleteStaffAction } from "@/actions/staff"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DialogForm } from "@/components/ui/dialog-form"
import { ResponsiveList } from "@/components/admin/ResponsiveList"
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton"

type Staff = { id: string; full_name: string; role: string }

function EditStaffDialog({ staff }: { staff: Staff }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fullName, setFullName] = useState(staff.full_name)
  const [role, setRole] = useState<"admin" | "quan_sinh">(staff.role === "admin" ? "admin" : "quan_sinh")

  async function submit() {
    setSubmitting(true)
    const result = await updateStaffAction({ id: staff.id, fullName, role })
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã cập nhật")
    setOpen(false)
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Sửa" onClick={() => setOpen(true)}>
        <PencilIcon className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa nhân sự</DialogTitle>
          </DialogHeader>
          <DialogForm onSubmit={submit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-staff-name">Họ tên</Label>
                <Input id="edit-staff-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-staff-role">Vai trò</Label>
                <NativeSelect id="edit-staff-role" value={role} onChange={(e) => setRole(e.target.value as "admin" | "quan_sinh")}>
                  <option value="quan_sinh">Quản sinh</option>
                  <option value="admin">Admin</option>
                </NativeSelect>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function StaffTable({ staff, currentUserId }: { staff: Staff[]; currentUserId: string }) {
  return (
    <ResponsiveList
      items={staff}
      emptyMessage="Chưa có nhân sự nào."
      table={
        <Table>
          <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>Vai trò</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {staff.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.full_name}</TableCell>
                <TableCell>{s.role === "admin" ? "Admin" : "Quản sinh"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditStaffDialog staff={s} />
                    {s.id !== currentUserId && (
                      <DeleteConfirmButton
                        title={`Xoá tài khoản ${s.full_name}?`}
                        description="Không thể xoá nếu tài khoản này đã tạo lịch/khoá lịch trong hệ thống."
                        onConfirm={() => deleteStaffAction(s.id)}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
      card={(s) => (
        <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{s.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{s.role === "admin" ? "Admin" : "Quản sinh"}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <EditStaffDialog staff={s} />
            {s.id !== currentUserId && (
              <DeleteConfirmButton
                title={`Xoá tài khoản ${s.full_name}?`}
                description="Không thể xoá nếu tài khoản này đã tạo lịch/khoá lịch trong hệ thống."
                onConfirm={() => deleteStaffAction(s.id)}
              />
            )}
          </div>
        </div>
      )}
    />
  )
}
