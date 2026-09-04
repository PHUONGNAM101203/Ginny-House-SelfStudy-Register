"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangleIcon, PencilIcon } from "lucide-react"
import { cancelRegistrationAsAdminAction, updateRegistrationDetailsAction } from "@/actions/registrations"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

  // Staff fix a typo in the tên / lớp / SĐT here rather than having to cancel
  // the booking and make it again.
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fullName: studentName ?? "",
    phone: phone ?? "",
    className: className ?? "",
  })

  async function save() {
    setSaving(true)
    const result = await updateRegistrationDetailsAction({ registrationId, ...form })
    setSaving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Đã cập nhật thông tin")
    setEditing(false)
    onOpenChange(false)
    onSuccess()
  }

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
          {/* pr-8 clears DialogContent's own absolutely-positioned close
              button (top-2 right-2) — without it the × sits on top of the
              edit button and swallows the click. */}
          <DialogTitle className="flex items-center justify-between gap-2 pr-8">
            <span>{editing ? "Sửa thông tin lịch" : "Chi tiết lịch"}</span>
            {audience === "staff" && !editing && studentName && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Sửa thông tin"
                title="Sửa thông tin"
                onClick={() => setEditing(true)}
              >
                <PencilIcon className="size-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {audience === "guest-other" && (
          <div className="flex items-start gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs">
            <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-gold-foreground" />
            <span className="text-gold-foreground">
              Đây là lịch của bạn khác đã đăng ký. Bạn chỉ xem được, không huỷ được lịch này.
            </span>
          </div>
        )}

        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-reg-name">Họ tên</Label>
              <Input
                id="edit-reg-name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-reg-class">Lớp</Label>
              <Input
                id="edit-reg-class"
                value={form.className}
                placeholder="VD: L2-04-26"
                onChange={(e) => setForm({ ...form, className: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-reg-phone">Số điện thoại</Label>
              <Input
                id="edit-reg-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sửa ở đây cập nhật cả hồ sơ học sinh và lịch cố định của bạn ấy (nếu có).
            </p>
          </div>
        ) : (
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
        )}

        {audience === "staff" && editing && (
          <DialogFooter>
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
              Huỷ bỏ
            </Button>
          </DialogFooter>
        )}
        {audience === "staff" && !editing && canCancel && (
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
