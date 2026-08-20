"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createSlotLockAction } from "@/actions/slot-locks"
import { DAY_LABELS } from "@/lib/validations/slot-lock"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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
    <div className="flex flex-wrap items-end gap-2">
      <select className="rounded border px-2 py-2" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value, deskId: "" })}>
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <select className="rounded border px-2 py-2" value={form.deskId} onChange={(e) => setForm({ ...form, deskId: e.target.value })}>
        <option value="">Cả cơ sở</option>
        {branchDesks.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
      <select className="rounded border px-2 py-2" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}>
        {Object.entries(DAY_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
      <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
      <Input placeholder="Lý do (tuỳ chọn)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      <Button onClick={submit}>Khoá</Button>
    </div>
  )
}
