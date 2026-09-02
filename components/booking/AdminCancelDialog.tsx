"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cancelRegistrationAsAdminAction, reviewRecurringRegistrationAction } from "@/actions/registrations"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Admin's direct cancel from the internal calendar — no name/phone
 * re-entry, unlike the guest-facing CancelDialog. This is what was missing
 * entirely before (InternalScheduleGridClient rendered nothing at all when
 * an admin clicked an existing booking): the RPC's admin bypass already
 * existed (migration 0002's cancel_registration), only this UI didn't.
 */
export function AdminCancelDialog({
  open,
  onOpenChange,
  registrationId,
  deskLabel,
  studentName,
  className,
  startTime,
  endTime,
  recurringRegistrationId,
  recurringApproved,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  registrationId: string
  deskLabel: string
  studentName: string
  className: string | null
  startTime: string
  endTime: string
  recurringRegistrationId: string | null
  /** False = a guest's lịch cố định request still waiting on an admin. */
  recurringApproved?: boolean | null
  onSuccess: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const isPending = !!recurringRegistrationId && recurringApproved === false

  async function review(approve: boolean) {
    if (!recurringRegistrationId) return
    setReviewing(true)
    const result = await reviewRecurringRegistrationAction(recurringRegistrationId, approve)
    setReviewing(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success(approve ? "Đã duyệt lịch cố định" : "Đã từ chối lịch cố định")
    onOpenChange(false)
    onSuccess()
  }

  async function handleCancel() {
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
          <DialogTitle>Huỷ đăng ký {deskLabel} — {startTime}-{endTime}</DialogTitle>
          <DialogDescription>
            {studentName}
            {className ? ` · Lớp ${className}` : ""}
            <br />
            {isPending ? "Lịch cố định · đang chờ duyệt" : recurringRegistrationId ? "Lịch cố định" : "Lịch bình thường"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {/* Approving is the common action on a pending request, so it leads
              and the destructive cancel sits apart from it. */}
          {isPending && (
            <>
              <Button type="button" disabled={reviewing} onClick={() => review(true)}>
                {reviewing ? "Đang xử lý..." : "Duyệt lịch cố định"}
              </Button>
              <Button type="button" variant="outline" disabled={reviewing} onClick={() => review(false)}>
                Từ chối
              </Button>
            </>
          )}
          <Button type="button" variant="destructive" disabled={submitting} onClick={handleCancel}>
            {submitting ? "Đang huỷ..." : "Xác nhận huỷ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
