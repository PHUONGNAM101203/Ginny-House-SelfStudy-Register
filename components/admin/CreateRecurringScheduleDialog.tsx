"use client"

import { useState } from "react"
import { toast } from "sonner"
import { CalendarPlusIcon } from "lucide-react"
import { createRecurringScheduleAction } from "@/actions/students"
import { DAY_LABELS } from "@/lib/validations/slot-lock"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DialogForm } from "@/components/ui/dialog-form"

type Branch = { id: string; name: string }
type Desk = { id: string; branch_id: string; label: string }

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  deskId: "",
  dayOfWeek: 1,
  startTime: "08:00",
  endTime: "10:00",
  className: "",
  startDate: "",
  endDate: "",
}

export function CreateRecurringScheduleDialog({ branches, desks }: { branches: Branch[]; desks: Desk[] }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "")
  const [form, setForm] = useState(EMPTY_FORM)

  const branchDesks = desks.filter((d) => d.branch_id === branchId)

  async function submit() {
    setSubmitting(true)
    const result = await createRecurringScheduleAction({
      fullName: form.fullName,
      phone: form.phone,
      branchId,
      deskId: form.deskId,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      className: form.className || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    })
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã tạo lịch cố định")
    setOpen(false)
    setForm(EMPTY_FORM)
    setBranchId(branches[0]?.id ?? "")
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-fit">
        <CalendarPlusIcon />
        Tạo lịch cố định
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo lịch cố định</DialogTitle>
          </DialogHeader>
          <DialogForm onSubmit={submit}>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rs-name">Họ tên học sinh</Label>
                  <Input id="rs-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rs-phone">Số điện thoại</Label>
                  <Input id="rs-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rs-class">Lớp (tuỳ chọn)</Label>
                <Input id="rs-class" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rs-branch">Cơ sở</Label>
                  <NativeSelect
                    id="rs-branch"
                    value={branchId}
                    onChange={(e) => {
                      setBranchId(e.target.value)
                      setForm({ ...form, deskId: "" })
                    }}
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rs-desk">Chỗ ngồi</Label>
                  <NativeSelect id="rs-desk" value={form.deskId} onChange={(e) => setForm({ ...form, deskId: e.target.value })}>
                    <option value="">Chọn chỗ</option>
                    {branchDesks.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </NativeSelect>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rs-day">Thứ</Label>
                <NativeSelect
                  id="rs-day"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                >
                  {Object.entries(DAY_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>{label}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rs-start">Giờ bắt đầu</Label>
                  <Input id="rs-start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rs-end">Giờ kết thúc</Label>
                  <Input id="rs-end" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rs-start-date">Từ ngày (tuỳ chọn)</Label>
                  <Input id="rs-start-date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="rs-end-date">Cố định tới hạn (tuỳ chọn)</Label>
                  <Input id="rs-end-date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting || !form.deskId}>{submitting ? "Đang tạo..." : "Tạo lịch cố định"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
