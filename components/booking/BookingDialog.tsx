"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"
import { createRegistrationSchema, type CreateRegistrationInput } from "@/lib/validations/registration"
import { createRegistrationAction } from "@/actions/registrations"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/types"

export function BookingDialog({
  open, onOpenChange, deskId, deskLabel, date, startTime, endTime, onSuccess,
  action = createRegistrationAction,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  deskId: string; deskLabel: string; date: string; startTime: string; endTime: string
  onSuccess: () => void
  action?: (input: unknown) => Promise<ActionResult<{ id: string }>>
}) {
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<
    z.input<typeof createRegistrationSchema>,
    unknown,
    CreateRegistrationInput
  >({
    resolver: zodResolver(createRegistrationSchema),
    defaultValues: { deskId, date, startTime, endTime, isRecurring: false },
  })

  async function onSubmit(values: CreateRegistrationInput) {
    setSubmitting(true)
    const result = await action(values)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Đăng ký thành công!")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Đăng ký {deskLabel} — {startTime}-{endTime}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="fullName">Họ tên</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div>
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" {...register("phone")} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={watch("isRecurring") ?? false} onChange={(e) => setValue("isRecurring", e.target.checked)} />
            Đăng ký cố định (tự giữ chỗ mỗi tuần)
          </label>
          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Đang đăng ký..." : "Xác nhận"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
