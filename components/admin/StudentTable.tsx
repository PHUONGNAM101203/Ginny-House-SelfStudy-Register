"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

/** class_name is a "most recent known class" read from that student's registrations, not a stored attribute of the student. */
type Student = { id: string; full_name: string; phone: string; created_at: string; class_name: string | null }

export function StudentTable({ students }: { students: Student[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tên</TableHead><TableHead>Lớp</TableHead><TableHead>SĐT</TableHead><TableHead>Ngày tạo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students.map((s) => (
          <TableRow key={s.id}>
            <TableCell>{s.full_name}</TableCell>
            <TableCell>{s.class_name ?? "—"}</TableCell>
            <TableCell>{s.phone}</TableCell>
            <TableCell>{new Date(s.created_at).toLocaleDateString("vi-VN")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
