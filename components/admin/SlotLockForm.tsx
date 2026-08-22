"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { createSlotLockAction } from "@/actions/slot-locks"
import { DAY_LABELS } from "@/lib/validations/slot-lock"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

type Branch = { id: string; name: string }
type Desk = { id: string; branch_id: string; label: string }

export function SlotLockForm({ branches, desks }: { branches: Branch[]; desks: Desk[] }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    branchId: branches[0]?.id ?? "", deskId: "", dayOfWeek: 1, startTime: "08:00", endTime: "12:00", reason: "",
  })

  async function submit() {
    setSubmitting(true)
    const result = await createSlotLockAction({
      branchId: form.branchId,
      deskId: form.deskId || null,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      reason: form.reason || undefined,
    })
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã khoá lịch")
    setOpen(false)
    setForm({ branchId: branches[0]?.id ?? "", deskId: "", dayOfWeek: 1, startTime: "08:00", endTime: "12:00", reason: "" })
  }

  const branchDesks = desks.filter((d) => d.branch_id === form.branchId)

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-fit">
        <PlusIcon />
        Khoá lịch mới
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Khoá lịch mới</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lock-branch">Cơ sở</Label>
              <NativeSelect
                id="lock-branch"
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value, deskId: "" })}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lock-desk">Chỗ ngồi</Label>
              <NativeSelect id="lock-desk" value={form.deskId} onChange={(e) => setForm({ ...form, deskId: e.target.value })}>
                <option value="">Cả cơ sở</option>
                {branchDesks.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lock-day">Thứ</Label>
              <NativeSelect
                id="lock-day"
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
                <Label htmlFor="lock-start">Giờ bắt đầu</Label>
                <Input id="lock-start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lock-end">Giờ kết thúc</Label>
                <Input id="lock-end" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lock-reason">Lý do (tuỳ chọn)</Label>
              <Input id="lock-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Đang khoá..." : "Khoá"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
