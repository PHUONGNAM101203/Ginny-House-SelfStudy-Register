"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import type { ActionResult } from "@/types"

/**
 * Shared "xoá" confirmation used across desks/students/staff — each caller
 * only supplies its own action + description text; the confirm-dialog
 * mechanics (open state, submitting state, toast, error surfacing) live
 * here once instead of copy-pasted per entity.
 */
export function DeleteConfirmButton({
  title,
  description,
  onConfirm,
  iconOnly = true,
}: {
  title: string
  description: string
  onConfirm: () => Promise<ActionResult<null>>
  iconOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    const result = await onConfirm()
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Đã xoá")
    setOpen(false)
  }

  return (
    <>
      <Button
        variant="ghost"
        size={iconOnly ? "icon-sm" : "sm"}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label="Xoá"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon className="size-4" />
        {!iconOnly && "Xoá"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Huỷ
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Đang xoá..." : "Xác nhận xoá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
