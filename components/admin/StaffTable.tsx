"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Staff = { id: string; full_name: string; role: string }

export function StaffTable({ staff }: { staff: Staff[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>Vai trò</TableHead></TableRow></TableHeader>
      <TableBody>
        {staff.map((s) => (
          <TableRow key={s.id}><TableCell>{s.full_name}</TableCell><TableCell>{s.role === "admin" ? "Admin" : "Quản sinh"}</TableCell></TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
