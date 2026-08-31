"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PencilIcon } from "lucide-react"
import { updateStudentAction, deleteStudentAction } from "@/actions/students"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ResponsiveList } from "@/components/admin/ResponsiveList"
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton"

/** class_name is a "most recent known class" read from that student's registrations, not a stored attribute of the student. */
type Student = { id: string; full_name: string; phone: string; created_at: string; class_name: string | null }

function EditStudentDialog({ student }: { student: Student }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fullName, setFullName] = useState(student.full_name)
  const [phone, setPhone] = useState(student.phone)

  async function submit() {
    setSubmitting(true)
    const result = await updateStudentAction({ id: student.id, fullName, phone })
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã cập nhật học sinh")
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
            <DialogTitle>Sửa học sinh</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-student-name">Họ tên</Label>
              <Input id="edit-student-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-student-phone">Số điện thoại</Label>
              <Input id="edit-student-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function StudentTable({ students }: { students: Student[] }) {
  return (
    <ResponsiveList
      items={students}
      emptyMessage="Chưa có học sinh nào."
      table={
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead><TableHead>Lớp</TableHead><TableHead>SĐT</TableHead><TableHead>Ngày tạo</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.full_name}</TableCell>
                <TableCell>{s.class_name ?? "—"}</TableCell>
                <TableCell>{s.phone}</TableCell>
                <TableCell>{new Date(s.created_at).toLocaleDateString("vi-VN")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <EditStudentDialog student={s} />
                    <DeleteConfirmButton
                      title={`Xoá học sinh ${s.full_name}?`}
                      description="Không thể xoá nếu học sinh đã có lịch sử đăng ký — dữ liệu này cần được giữ lại."
                      onConfirm={() => deleteStudentAction(s.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
      card={(s) => (
        <div key={s.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{s.full_name}</p>
            {s.class_name && <p className="truncate text-xs text-muted-foreground">{s.class_name}</p>}
            <p className="truncate text-xs text-muted-foreground">{s.phone}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <EditStudentDialog student={s} />
            <DeleteConfirmButton
              title={`Xoá học sinh ${s.full_name}?`}
              description="Không thể xoá nếu học sinh đã có lịch sử đăng ký — dữ liệu này cần được giữ lại."
              onConfirm={() => deleteStudentAction(s.id)}
            />
          </div>
        </div>
      )}
    />
  )
}
