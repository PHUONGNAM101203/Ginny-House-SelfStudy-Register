"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PlusIcon } from "lucide-react"
import { createStaffAction } from "@/actions/staff"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DialogForm } from "@/components/ui/dialog-form"

const EMPTY_FORM = { fullName: "", email: "", password: "", role: "quan_sinh" as "admin" | "quan_sinh" }

export function StaffForm() {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  async function submit() {
    setSubmitting(true)
    const result = await createStaffAction(form)
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã tạo tài khoản")
    setOpen(false)
    setForm(EMPTY_FORM)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-fit">
        <PlusIcon />
        Tạo tài khoản
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo tài khoản nhân sự</DialogTitle>
          </DialogHeader>
          <DialogForm onSubmit={submit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-name">Họ tên</Label>
                <Input id="staff-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-email">Email</Label>
                <Input id="staff-email" type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-password">Mật khẩu</Label>
                {/* autoComplete="new-password": this creates a *different*
                    person's account, so an unannotated type="password" invites
                    the browser to autofill the signed-in admin's own credentials. */}
                <Input id="staff-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="staff-role">Vai trò</Label>
                <NativeSelect id="staff-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "quan_sinh" })}>
                  <option value="quan_sinh">Quản sinh</option>
                  <option value="admin">Admin</option>
                </NativeSelect>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={submitting}>{submitting ? "Đang tạo..." : "Tạo tài khoản"}</Button>
            </DialogFooter>
          </DialogForm>
        </DialogContent>
      </Dialog>
    </>
  )
}
