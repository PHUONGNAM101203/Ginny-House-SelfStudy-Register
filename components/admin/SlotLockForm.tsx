"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createSlotLockAction } from "@/actions/slot-locks"
import { DAY_LABELS } from "@/lib/validations/slot-lock"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect } from "@/components/ui/native-select"

type Branch = { id: string; name: string }
type Desk = { id: string; branch_id: string; label: string }

export function SlotLockForm({ branches, desks }: { branches: Branch[]; desks: Desk[] }) {
  const [form, setForm] = useState({
    branchId: branches[0]?.id ?? "", deskId: "", dayOfWeek: 1, startTime: "08:00", endTime: "12:00", reason: "",
  })

  async function submit() {
    const result = await createSlotLockAction({
      branchId: form.branchId,
      deskId: form.deskId || null,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      reason: form.reason || undefined,
    })
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã khoá lịch")
  }

  const branchDesks = desks.filter((d) => d.branch_id === form.branchId)

  return (
    // Stacked on a phone, inline from `sm`: a native select sizes itself to its
    // widest option ("Cơ sở Hồ Xương Rồng" here), which at 320px pushed its own
    // label under the dropdown arrow when these sat on one row.
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <NativeSelect aria-label="Cơ sở" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, deskId: "" })}>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Chỗ ngồi" value={form.deskId} onChange={(e) => setForm({ ...form, deskId: e.target.value })}>
        <option value="">Cả cơ sở</option>
        {branchDesks.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Thứ" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
        {Object.entries(DAY_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </NativeSelect>
      <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
      <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
      <Input placeholder="Lý do (tuỳ chọn)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      <Button onClick={submit}>Khoá</Button>
    </div>
  )
}
