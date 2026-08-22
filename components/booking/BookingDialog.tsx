"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { z } from "zod"
import { createRegistrationSchema, type CreateRegistrationInput } from "@/lib/validations/registration"
import { createRegistrationAction, findStudentByPhonePrefixAction, type StudentLookupResult } from "@/actions/registrations"
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
    defaultValues: { deskId, date, startTime, endTime, className: "", zaloContact: "", isRecurring: false },
  })

  const phone = watch("phone")
  const [suggestion, setSuggestion] = useState<StudentLookupResult | null>(null)
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false)

  // Debounced lookup: once the guest has typed at least 4 digits of their
  // own phone number, offer to prefill from their most recent registration
  // (find_student_by_phone_prefix, migration 0008) — never fires on the
  // name field, only phone (see that RPC's comment for why).
  useEffect(() => {
    setDismissedSuggestion(false)
    if (!phone || phone.length < 4) {
      setSuggestion(null)
      return
    }
    const timeout = setTimeout(async () => {
      const result = await findStudentByPhonePrefixAction(phone)
      if (result.ok) setSuggestion(result.data)
    }, 400)
    return () => clearTimeout(timeout)
  }, [phone])

  function applySuggestion() {
    if (!suggestion) return
    setValue("fullName", suggestion.fullName)
    setValue("phone", suggestion.phone)
    if (suggestion.className) setValue("className", suggestion.className)
    setDismissedSuggestion(true)
  }

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
        {/* gap-1.5 inside each field: the label used to sit flush on the input's
            top border, which read as cramped at every width. */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Họ tên</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" {...register("phone")} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            {suggestion && !dismissedSuggestion && (
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs">
                <span>
                  Có phải bạn là <span className="font-medium">{suggestion.fullName}</span>
                  {suggestion.className && <> · {suggestion.className}</>}?
                </span>
                <Button type="button" size="sm" variant="secondary" className="h-6 px-2 text-xs" onClick={applySuggestion}>
                  Điền tự động
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="className">Tên lớp</Label>
            <Input id="className" {...register("className")} />
            {errors.className && <p className="text-sm text-destructive">{errors.className.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="zaloContact">Zalo liên hệ (không bắt buộc)</Label>
            <Input id="zaloContact" placeholder="Số điện thoại hoặc tên Zalo" {...register("zaloContact")} />
            {errors.zaloContact && <p className="text-sm text-destructive">{errors.zaloContact.message}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            {/* accent-* keeps the native control on the brand colour instead of
                rendering as a stray light-grey square on the dark surface. */}
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-[var(--primary)]"
              checked={watch("isRecurring") ?? false}
              onChange={(e) => setValue("isRecurring", e.target.checked)}
            />
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
