"use client"

import { useState } from "react"
import { toast } from "sonner"
import { createBranchAction } from "@/actions/branches"
import { createDeskAction, toggleDeskActiveAction } from "@/actions/desks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Branch = { id: string; code: string; name: string }
type Desk = { id: string; branch_id: string; label: string; active: boolean }

export function BranchDeskManager({ branches, desks }: { branches: Branch[]; desks: Desk[] }) {
  const [newBranch, setNewBranch] = useState({ code: "", name: "" })
  const [newDesk, setNewDesk] = useState<{ branchId: string; label: string }>({ branchId: branches[0]?.id ?? "", label: "" })

  async function addBranch() {
    const result = await createBranchAction(newBranch)
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã thêm cơ sở")
    setNewBranch({ code: "", name: "" })
  }

  async function addDesk() {
    const result = await createDeskAction({ ...newDesk, active: true })
    if (!result.ok) return toast.error(result.error)
    toast.success("Đã thêm chỗ")
    setNewDesk({ ...newDesk, label: "" })
  }

  async function toggleDesk(id: string, active: boolean) {
    const result = await toggleDeskActiveAction(id, active)
    if (!result.ok) toast.error(result.error)
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="mb-2 font-medium">Cơ sở</h2>
        <div className="mb-4 flex gap-2">
          <Input placeholder="Mã (vd: hoang-gia)" value={newBranch.code} onChange={(e) => setNewBranch({ ...newBranch, code: e.target.value })} />
          <Input placeholder="Tên cơ sở" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} />
          <Button onClick={addBranch}>Thêm</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Mã</TableHead><TableHead>Tên</TableHead></TableRow></TableHeader>
          <TableBody>
            {branches.map((b) => (
              <TableRow key={b.id}><TableCell>{b.code}</TableCell><TableCell>{b.name}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Chỗ ngồi</h2>
        <div className="mb-4 flex gap-2">
          <select className="rounded border px-2" value={newDesk.branchId} onChange={(e) => setNewDesk({ ...newDesk, branchId: e.target.value })}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <Input placeholder="Tên chỗ (vd: Chỗ 11)" value={newDesk.label} onChange={(e) => setNewDesk({ ...newDesk, label: e.target.value })} />
          <Button onClick={addDesk}>Thêm</Button>
        </div>
        <Table>
          <TableHeader><TableRow><TableHead>Cơ sở</TableHead><TableHead>Chỗ</TableHead><TableHead>Trạng thái</TableHead></TableRow></TableHeader>
          <TableBody>
            {desks.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{branches.find((b) => b.id === d.branch_id)?.name}</TableCell>
                <TableCell>{d.label}</TableCell>
                <TableCell>
                  <Button size="sm" variant={d.active ? "outline" : "secondary"} onClick={() => toggleDesk(d.id, !d.active)}>
                    {d.active ? "Đang mở — tắt" : "Đã tắt — bật lại"}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
