"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangleIcon } from "lucide-react"
import { cancelRegistrationAsAdminAction } from "@/actions/registrations"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BOOKING_KIND_LABEL, bookingKind } from "@/lib/booking-kind"

/**
 * Who is looking, and therefore what they get:
 *
 *   staff      quản sinh and admin — full details including SĐT, plus a
 *              direct huỷ (migration 0034 lets any staff cancel outright).
 *   guest-own  the booking this browser made — full details and a huỷ that
 *              goes to the admin as a phiếu.
 *   guest-other  someone else's booking — details only, no huỷ, and said so
 *              plainly rather than leaving a dead button.
 */
export type BookingDetailAudience = "staff" | "guest-own" | "guest-other"

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

export function BookingDetailDialog({
  open,
  onOpenChange,
  audience,
  registrationId,
  deskLabel,
  branchName,
  date,
  startTime,
  endTime,
  studentName,
  className,
  phone,
  recurringRegistrationId,
  canCancel = true,
  onSuccess,
  onRequestCancel,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  audience: BookingDetailAudience
  registrationId: string
  deskLabel: string
  branchName?: string | null
  date: string
  startTime: string
  endTime: string
  studentName: string | null
  className: string | null
  phone?: string | null
  recurringRegistrationId: string | null
  /** Staff only: false hides the huỷ button without changing anything else. */
  canCancel?: boolean
  onSuccess: () => void
  /** guest-own: hands over to the phiếu flow. */
  onRequestCancel?: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const kind = bookingKind({ studentId: studentName ? "x" : null, recurringRegistrationId })

  async function cancelDirectly() {
    setSubmitting(true)
    const result = await cancelRegistrationAsAdminAction({ registrationId })
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
          <DialogTitle>Chi tiết lịch</DialogTitle>
        </DialogHeader>

        {audience === "guest-other" && (
          <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-gold-foreground" />
            <span className="text-gold-foreground">
              Đây là lịch của bạn khác đã đăng ký. Bạn chỉ xem được, không huỷ được lịch này.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Row label="Học sinh" value={studentName ?? "—"} />
          {className && <Row label="Lớp" value={className} />}
          {phone && <Row label="Số điện thoại" value={phone} />}
          {branchName && <Row label="Cơ sở" value={branchName} />}
          <Row label="Chỗ ngồi" value={deskLabel} />
          <Row label="Ngày" value={date} />
          <Row label="Giờ" value={`${startTime}-${endTime}`} />
          <Row label="Loại lịch" value={BOOKING_KIND_LABEL[kind]} />
        </div>

        {audience === "staff" && canCancel && (
          <DialogFooter>
            <Button type="button" variant="destructive" disabled={submitting} onClick={cancelDirectly}>
              {submitting ? "Đang huỷ..." : "Huỷ đăng ký"}
            </Button>
          </DialogFooter>
        )}
        {audience === "guest-own" && (
          <DialogFooter>
            <Button type="button" variant="destructive" onClick={onRequestCancel}>
              Gửi yêu cầu huỷ cho admin
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
