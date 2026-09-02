"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * Since migration 0031 a guest cannot cancel anything outright — every huỷ is
 * a phiếu an admin reviews ("khi hủy lịch đều báo về admin duyệt có cho hủy
 * hay không"). So this is no longer a cancel form at all: the name/phone
 * verification it used to collect could only ever produce a guaranteed
 * failure now, and it hands straight over to RequestChangeDialog instead.
 *
 * The component name stays put so every caller doesn't have to change; what
 * it does is what changed.
 */
export function CancelDialog({
  open,
  onOpenChange,
  deskLabel,
  startTime,
  endTime,
  isRecurring,
  onRequestChangeInstead,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  deskLabel: string
  startTime: string
  endTime: string
  /** Only changes the wording: a lịch cố định is also being given up for good. */
  isRecurring?: boolean
  onRequestChangeInstead?: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isRecurring ? "Huỷ lịch cố định" : "Huỷ đăng ký"} {deskLabel} — {startTime}-{endTime}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {isRecurring
              ? "Đây là lịch cố định hằng tuần. Bạn gửi yêu cầu huỷ để admin duyệt — được duyệt thì chỗ này mới mở lại cho bạn khác."
              : "Yêu cầu huỷ sẽ được gửi tới admin duyệt. Chỗ của bạn vẫn được giữ cho tới khi admin xác nhận."}
          </p>
          <DialogFooter>
            <Button type="button" variant="destructive" onClick={onRequestChangeInstead}>
              Gửi yêu cầu huỷ cho admin
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
