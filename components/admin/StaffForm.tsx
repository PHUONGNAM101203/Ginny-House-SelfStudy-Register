"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createStaffAction } from "@/actions/staff"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function StaffForm() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "quan_sinh" as "admin" | "quan_sinh" })

  async function submit() {
    const result = await createStaffAction(form)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã tạo tài khoản")
    setForm({ fullName: "", email: "", password: "", role: "quan_sinh" })
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Input placeholder="Họ tên" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
      <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <Input placeholder="Mật khẩu" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <select className="rounded border px-2 py-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "quan_sinh" })}>
        <option value="quan_sinh">Quản sinh</option>
        <option value="admin">Admin</option>
      </select>
      <Button onClick={submit}>Tạo tài khoản</Button>
    </div>
  )
}
