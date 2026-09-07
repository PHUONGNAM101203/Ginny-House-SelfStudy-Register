"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangleIcon, PencilIcon, PlusIcon } from "lucide-react"
import {
  cancelRecurringSeriesAction,
  cancelRegistrationAsAdminAction,
  updateRegistrationDetailsAction,
} from "@/actions/registrations"
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
  status = "active",
  canCancel = true,
  onSuccess,
  onRequestCancel,
  onCreateNew,
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
  /**
   * Without this a cancelled booking read as "Lịch bình thường" and still
   * offered Sửa / Huỷ — editing a booking nobody holds, and cancelling one
   * already cancelled.
   */
  status?: "active" | "cancelled"
  /** Staff only: false hides the huỷ button without changing anything else. */
  canCancel?: boolean
  onSuccess: () => void
  /** guest-own: hands over to the phiếu flow. */
  onRequestCancel?: () => void
  /**
   * Cancelled bookings only: the slot they were holding is free again, so
   * staff get a way straight into the booking flow for it. Guests never see
   * this dialog for a cancelled slot — their click opens the booking form
   * directly (see ScheduleGridClient / WeekOverviewClient).
   */
  onCreateNew?: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const cancelled = status === "cancelled"
  // Huỷ on a lịch cố định is two different actions wearing one word, so it
  // asks instead of choosing. A plain booking has only one meaning and goes
  // straight through.
  const [choosingScope, setChoosingScope] = useState(false)
  const isRecurring = recurringRegistrationId !== null
  const kind = bookingKind({ status, studentId: studentName ? "x" : null, recurringRegistrationId })

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

  async function cancelWholeSeries() {
    setSubmitting(true)
    const result = await cancelRecurringSeriesAction({ registrationId })
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(`Đã huỷ lịch cố định (${result.data.cancelled} buổi)`)
    onOpenChange(false)
    onSuccess()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa thông tin lịch" : "Chi tiết lịch"}</DialogTitle>
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
          <DialogFooter className="max-sm:flex-col">
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
              Huỷ bỏ
            </Button>
          </DialogFooter>
        )}
        {/* Editing sits with the other actions rather than as an icon in the
            title row. Up there it was 8px out of line with the dialog's own
            absolutely-positioned close button, and once icon buttons gained
            a finger-sized hit area on touch the two overlapped by 4px — so
            tapping near the edge hit the wrong one. */}
        {/* A cancelled booking is a record, not a live one: nothing to edit
            and nothing left to huỷ. What it does carry is a half hour that is
            free again, which is what the day grid has always let staff click
            into — this is that same action, made explicit. */}
        {audience === "staff" && !editing && cancelled && onCreateNew && (
          <DialogFooter className="max-sm:flex-col">
            <Button type="button" onClick={onCreateNew}>
              <PlusIcon className="size-4" />
              Tạo chỗ mới
            </Button>
          </DialogFooter>
        )}
        {/* max-sm:flex-col overrides DialogFooter's flex-col-reverse: that
            default puts the LAST child on top, which on a phone stacked
            "Huỷ đăng ký" above "Sửa thông tin". */}
        {/* Huỷ on a lịch cố định: which buổi did they mean? Cancelling one
            session and ending the whole weekly schedule are both reasonable
            readings of the same button, and until migration 0040 only one of
            them existed on the calendar. */}
        {audience === "staff" && !editing && !cancelled && choosingScope && (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-sm font-medium">Huỷ lịch cố định này thế nào?</p>
            <Button type="button" variant="outline" disabled={submitting} onClick={cancelDirectly}>
              Chỉ huỷ buổi này ({date})
            </Button>
            <Button type="button" variant="destructive" disabled={submitting} onClick={cancelWholeSeries}>
              Huỷ toàn bộ lịch cố định
            </Button>
            <p className="text-xs text-muted-foreground">
              Huỷ toàn bộ sẽ dừng lịch cố định và huỷ buổi này cùng tất cả các buổi sau. Các buổi đã học trước đó vẫn
              giữ nguyên.
            </p>
          </div>
        )}
        {audience === "staff" && !editing && !cancelled && studentName && (
          <DialogFooter className="max-sm:flex-col">
            {choosingScope ? (
              <Button type="button" variant="outline" disabled={submitting} onClick={() => setChoosingScope(false)}>
                Quay lại
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setEditing(true)}>
                  <PencilIcon className="size-4" />
                  Sửa thông tin
                </Button>
                {canCancel && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={submitting}
                    onClick={isRecurring ? () => setChoosingScope(true) : cancelDirectly}
                  >
                    {submitting ? "Đang huỷ..." : "Huỷ đăng ký"}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        )}
        {/* A vacant placeholder belongs to a rule as much as a claimed buổi
            does, so it gets the same question. */}
        {audience === "staff" && !editing && !cancelled && !studentName && canCancel && (
          <DialogFooter className="max-sm:flex-col">
            {choosingScope ? (
              <Button type="button" variant="outline" disabled={submitting} onClick={() => setChoosingScope(false)}>
                Quay lại
              </Button>
            ) : (
              <Button
                type="button"
                variant="destructive"
                disabled={submitting}
                onClick={isRecurring ? () => setChoosingScope(true) : cancelDirectly}
              >
                {submitting ? "Đang huỷ..." : "Huỷ đăng ký"}
              </Button>
            )}
          </DialogFooter>
        )}
        {audience === "guest-own" && !cancelled && (
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
