"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { createSlotLockAction } from "@/actions/slot-locks"
import { DAY_LABELS, type SlotLockMode } from "@/lib/validations/slot-lock"
import { describeLockScope } from "@/lib/slot-locks"
import { vietnamToday } from "@/lib/vn-date"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DialogForm } from "@/components/ui/dialog-form"

type Branch = { id: string; name: string }
type Desk = { id: string; branch_id: string; label: string }

const MODE_LABELS: Record<SlotLockMode, string> = {
  date: "Một ngày cụ thể",
  range: "Một khoảng ngày",
  weekly: "Lặp lại hằng tuần",
}

function emptyForm(branchId: string) {
  const today = vietnamToday()
  return {
    branchId,
    deskId: "",
    // Mặc định khoá một ngày — việc hay gặp nhất (thi thử, mất điện, sự
    // kiện). Khoá lặp lại mãi là lựa chọn nặng hơn nhiều nên phải chọn rõ.
    mode: "date" as SlotLockMode,
    date: today,
    from: today,
    to: today,
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "12:00",
    reason: "",
  }
}

export function SlotLockForm({ branches, desks }: { branches: Branch[]; desks: Desk[] }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(() => emptyForm(branches[0]?.id ?? ""))

  // The same sentence the table will show for this lock once it exists, so
  // what you are about to create is spelled out before you create it.
  const preview = describeLockScope(
    form.mode === "weekly"
      ? { dayOfWeek: form.dayOfWeek, effectiveFrom: null, effectiveTo: null }
      : form.mode === "date"
        ? { dayOfWeek: null, effectiveFrom: form.date, effectiveTo: form.date }
        : { dayOfWeek: null, effectiveFrom: form.from, effectiveTo: form.to }
  )

  async function submit() {
    setSubmitting(true)
    const scope =
      form.mode === "weekly"
        ? { mode: "weekly" as const, dayOfWeek: form.dayOfWeek }
        : form.mode === "date"
          ? { mode: "date" as const, date: form.date }
          : { mode: "range" as const, from: form.from, to: form.to }

    const result = await createSlotLockAction({
      branchId: form.branchId,
      deskId: form.deskId || null,
      ...scope,
      startTime: form.startTime,
      endTime: form.endTime,
      reason: form.reason || undefined,
    })
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã khoá lịch")
    setOpen(false)
    setForm(emptyForm(branches[0]?.id ?? ""))
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
          <DialogForm onSubmit={submit}>
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
                <Label htmlFor="lock-mode">Khoá khi nào</Label>
                <NativeSelect
                  id="lock-mode"
                  value={form.mode}
                  onChange={(e) => setForm({ ...form, mode: e.target.value as SlotLockMode })}
                >
                  {(Object.keys(MODE_LABELS) as SlotLockMode[]).map((m) => (
                    <option key={m} value={m}>{MODE_LABELS[m]}</option>
                  ))}
                </NativeSelect>
              </div>

              {form.mode === "date" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lock-date">Ngày</Label>
                  <Input id="lock-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              )}
              {form.mode === "range" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lock-from">Từ ngày</Label>
                    <Input id="lock-from" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="lock-to">Đến ngày</Label>
                    <Input id="lock-to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                  </div>
                </div>
              )}
              {form.mode === "weekly" && (
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
              )}

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
                <Input id="lock-reason" placeholder="VD: thi thử" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </div>

              <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Sẽ khoá: <span className="font-medium text-foreground">{preview}</span>, {form.startTime}–{form.endTime}
                {form.mode === "weekly" && " — cho đến khi gỡ"}
              </p>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>{submitting ? "Đang khoá..." : "Khoá"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
