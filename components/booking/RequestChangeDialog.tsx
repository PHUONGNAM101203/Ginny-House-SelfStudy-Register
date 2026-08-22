"use client"

import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { requestChangeSchema, type RequestChangeInput } from "@/lib/validations/registration"
import { requestRegistrationChangeAction } from "@/actions/registrations"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { NativeSelect } from "@/components/ui/native-select"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { TIME_SLOTS } from "@/lib/time-slots"
import { parseYmd } from "@/lib/vn-date"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

const NO_NEW_SLOT = ""

export function RequestChangeDialog({
  open,
  onOpenChange,
  registrationId,
  deskLabel,
  date,
  startTime,
  endTime,
  studentName,
  className,
  desks,
  registrations,
  locks,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  registrationId: string
  deskLabel: string
  /** "yyyy-MM-dd" — the booking's own day (see lib/vn-date.ts). */
  date: string
  startTime: string
  endTime: string
  studentName: string
  className: string | null
  desks: Desk[]
  /** Same-day slice is enough — the optional new-slot picker only offers this day. */
  registrations: RegistrationRow[]
  locks: SlotLock[]
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RequestChangeInput>({
    resolver: zodResolver(requestChangeSchema),
    defaultValues: { registrationId, kind: "cancel", requestedByName: "", requestedByPhone: "", reason: "" },
  })
  const kind = watch("kind")

  // Every open half-hour, across every desk, on this same day — scoped to a
  // single day (not the whole week) so this stays a quick optional picker
  // rather than its own mini schedule-grid component.
  const availableSlots = useMemo(() => {
    const isoDow = ((parseYmd(date).getDay() + 6) % 7) + 1
    return desks.flatMap((desk) =>
      TIME_SLOTS.filter((slot) => {
        const locked = locks.some(
          (l) => (l.deskId === desk.id || l.deskId === null) && l.dayOfWeek === isoDow && l.startTime < slot.end && l.endTime > slot.start
        )
        if (locked) return false
        const booked = registrations.some(
          (r) => r.deskId === desk.id && r.date === date && r.id !== registrationId && r.startTime < slot.end && r.endTime > slot.start
        )
        return !booked
      }).map((slot) => ({
        value: `${desk.id}|${slot.start}|${slot.end}`,
        label: `${desk.label} — ${slot.start}-${slot.end}`,
        deskId: desk.id,
        start: slot.start,
        end: slot.end,
      }))
    )
  }, [desks, registrations, locks, date, registrationId])

  function onNewSlotChange(value: string) {
    if (value === NO_NEW_SLOT) {
      setValue("newDeskId", undefined)
      setValue("newDate", undefined)
      setValue("newStartTime", undefined)
      setValue("newEndTime", undefined)
      return
    }
    const picked = availableSlots.find((s) => s.value === value)
    if (!picked) return
    setValue("newDeskId", picked.deskId)
    setValue("newDate", date)
    setValue("newStartTime", picked.start)
    setValue("newEndTime", picked.end)
  }

  async function onSubmit(values: RequestChangeInput) {
    setSubmitting(true)
    const result = await requestRegistrationChangeAction(values)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Đã gửi yêu cầu, chờ admin duyệt")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gửi yêu cầu — {deskLabel} · {startTime}-{endTime}</DialogTitle>
          <DialogDescription>
            {studentName}
            {className ? ` · Lớp ${className}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Yêu cầu</Label>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" value="cancel" className="accent-[var(--primary)]" {...register("kind")} />
                Xin huỷ
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" value="reschedule" className="accent-[var(--primary)]" {...register("kind")} />
                Xin đổi lịch
              </label>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="requestedByName">Họ tên</Label>
            <Input id="requestedByName" {...register("requestedByName")} />
            {errors.requestedByName && <p className="text-sm text-destructive">{errors.requestedByName.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="requestedByPhone">Số điện thoại</Label>
            <Input id="requestedByPhone" {...register("requestedByPhone")} />
            {errors.requestedByPhone && <p className="text-sm text-destructive">{errors.requestedByPhone.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Lý do</Label>
            <Textarea id="reason" {...register("reason")} />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
          </div>
          {kind === "reschedule" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newSlot">Giờ mới muốn đổi sang (không bắt buộc)</Label>
              <NativeSelect id="newSlot" defaultValue={NO_NEW_SLOT} onChange={(e) => onNewSlotChange(e.target.value)}>
                <option value={NO_NEW_SLOT}>-- Để admin sắp xếp --</option>
                {availableSlots.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </NativeSelect>
              {errors.root?.message && <p className="text-sm text-destructive">{errors.root.message}</p>}
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Đang gửi..." : "Gửi yêu cầu"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
