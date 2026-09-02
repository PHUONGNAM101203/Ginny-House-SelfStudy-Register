"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { createStudentAction } from "@/actions/students"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DialogForm } from "@/components/ui/dialog-form"

export function CreateStudentDialog() {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ fullName: "", phone: "" })

  async function submit() {
    setSubmitting(true)
    const result = await createStudentAction(form)
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã thêm học sinh")
    setOpen(false)
    setForm({ fullName: "", phone: "" })
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="w-fit">
        <PlusIcon />
        Thêm học sinh
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm học sinh</DialogTitle>
          </DialogHeader>
          <DialogForm onSubmit={submit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="student-name">Họ tên</Label>
                <Input id="student-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="student-phone">Số điện thoại</Label>
                <Input id="student-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>{submitting ? "Đang thêm..." : "Thêm"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
