"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PlusIcon, PencilIcon } from "lucide-react"
import { createBranchAction, updateBranchAction } from "@/actions/branches"
import { createDeskAction, updateDeskAction, toggleDeskActiveAction, deleteDeskAction } from "@/actions/desks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ResponsiveList } from "@/components/admin/ResponsiveList"
import { DeleteConfirmButton } from "@/components/admin/DeleteConfirmButton"

type Branch = { id: string; code: string; name: string }
type Desk = { id: string; branch_id: string; label: string; active: boolean }

function CreateBranchDialog() {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ code: "", name: "" })

  async function submit() {
    setSubmitting(true)
    const result = await createBranchAction(form)
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã thêm cơ sở")
    setOpen(false)
    setForm({ code: "", name: "" })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-fit">
        <PlusIcon />
        Thêm cơ sở
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm cơ sở</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-code">Mã (vd: hoang-gia)</Label>
              <Input id="branch-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-name">Tên cơ sở</Label>
              <Input id="branch-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Đang thêm..." : "Thêm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EditBranchDialog({ branch }: { branch: Branch }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [name, setName] = useState(branch.name)

  async function submit() {
    setSubmitting(true)
    const result = await updateBranchAction({ id: branch.id, name })
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã cập nhật cơ sở")
    setOpen(false)
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Sửa" onClick={() => setOpen(true)}>
        <PencilIcon className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa cơ sở</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-branch-name">Tên cơ sở</Label>
              <Input id="edit-branch-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CreateDeskDialog({ branches }: { branches: Branch[] }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ branchId: branches[0]?.id ?? "", label: "" })

  async function submit() {
    setSubmitting(true)
    const result = await createDeskAction({ ...form, active: true })
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã thêm chỗ")
    setOpen(false)
    setForm({ branchId: branches[0]?.id ?? "", label: "" })
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="w-fit">
        <PlusIcon />
        Thêm chỗ
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm chỗ ngồi</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="desk-branch">Cơ sở</Label>
              <NativeSelect id="desk-branch" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="desk-label">Tên chỗ (vd: Chỗ 11)</Label>
              <Input id="desk-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Đang thêm..." : "Thêm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EditDeskDialog({ desk }: { desk: Desk }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [label, setLabel] = useState(desk.label)

  async function submit() {
    setSubmitting(true)
    const result = await updateDeskAction({ id: desk.id, label })
    setSubmitting(false)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã cập nhật chỗ")
    setOpen(false)
  }

  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Sửa" onClick={() => setOpen(true)}>
        <PencilIcon className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa chỗ ngồi</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-desk-label">Tên chỗ</Label>
              <Input id="edit-desk-label" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={submitting}>{submitting ? "Đang lưu..." : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function BranchDeskManager({ branches, desks }: { branches: Branch[]; desks: Desk[] }) {
  async function toggleDesk(id: string, active: boolean) {
    const result = await toggleDeskActiveAction(id, active)
    if (!result.ok) toast.error(result.error)
  }

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]))

  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Cơ sở</h2>
          <CreateBranchDialog />
        </div>
        <ResponsiveList
          items={branches}
          emptyMessage="Chưa có cơ sở nào."
          table={
            <Table>
              <TableHeader><TableRow><TableHead>Mã</TableHead><TableHead>Tên</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.code}</TableCell>
                    <TableCell>{b.name}</TableCell>
                    <TableCell className="text-right"><EditBranchDialog branch={b} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
          card={(b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{b.name}</p>
                <p className="truncate text-xs text-muted-foreground">{b.code}</p>
              </div>
              <EditBranchDialog branch={b} />
            </div>
          )}
        />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Chỗ ngồi</h2>
          <CreateDeskDialog branches={branches} />
        </div>
        <ResponsiveList
          items={desks}
          emptyMessage="Chưa có chỗ ngồi nào."
          table={
            <Table>
              <TableHeader>
                <TableRow><TableHead>Cơ sở</TableHead><TableHead>Chỗ</TableHead><TableHead>Trạng thái</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {desks.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{branchNameById.get(d.branch_id)}</TableCell>
                    <TableCell>{d.label}</TableCell>
                    <TableCell>
                      <Button size="sm" variant={d.active ? "outline" : "secondary"} onClick={() => toggleDesk(d.id, !d.active)}>
                        {d.active ? "Đang mở — tắt" : "Đã tắt — bật lại"}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditDeskDialog desk={d} />
                        <DeleteConfirmButton
                          title={`Xoá ${d.label}?`}
                          description="Chỗ chưa có lịch sử đăng ký nào mới xoá được — nếu đã có, hãy tắt chỗ thay vì xoá."
                          onConfirm={() => deleteDeskAction(d.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          }
          card={(d) => (
            <div key={d.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{branchNameById.get(d.branch_id)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <EditDeskDialog desk={d} />
                  <DeleteConfirmButton
                    title={`Xoá ${d.label}?`}
                    description="Chỗ chưa có lịch sử đăng ký nào mới xoá được — nếu đã có, hãy tắt chỗ thay vì xoá."
                    onConfirm={() => deleteDeskAction(d.id)}
                  />
                </div>
              </div>
              <Button size="sm" variant={d.active ? "outline" : "secondary"} onClick={() => toggleDesk(d.id, !d.active)}>
                {d.active ? "Đang mở — tắt" : "Đã tắt — bật lại"}
              </Button>
            </div>
          )}
        />
      </section>
    </div>
  )
}
