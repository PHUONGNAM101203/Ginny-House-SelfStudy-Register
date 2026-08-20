"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { cancelRegistrationSchema, type CancelRegistrationInput } from "@/lib/validations/registration"
import { cancelRegistrationAction } from "@/actions/registrations"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function CancelDialog({
  open, onOpenChange, registrationId, deskLabel, startTime, endTime, onSuccess,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  registrationId: string; deskLabel: string; startTime: string; endTime: string
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<CancelRegistrationInput>({
    resolver: zodResolver(cancelRegistrationSchema),
    defaultValues: { registrationId },
  })

  async function onSubmit(values: CancelRegistrationInput) {
    setSubmitting(true)
    const result = await cancelRegistrationAction(values)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Đã huỷ đăng ký")
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Huỷ đăng ký {deskLabel} — {startTime}-{endTime}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Nhập lại đúng Tên + SĐT đã dùng để đăng ký để xác nhận huỷ.</p>
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
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={submitting}>
              {submitting ? "Đang huỷ..." : "Xác nhận huỷ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
