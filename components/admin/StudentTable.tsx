"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Student = { id: string; full_name: string; phone: string; created_at: string }

export function StudentTable({ students }: { students: Student[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>SĐT</TableHead><TableHead>Ngày tạo</TableHead></TableRow></TableHeader>
      <TableBody>
        {students.map((s) => (
          <TableRow key={s.id}>
            <TableCell>{s.full_name}</TableCell>
            <TableCell>{s.phone}</TableCell>
            <TableCell>{new Date(s.created_at).toLocaleDateString("vi-VN")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
