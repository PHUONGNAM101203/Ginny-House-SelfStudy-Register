import type { FrequencyRow } from "@/lib/dashboard"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function FrequencyRanking({ rows }: { rows: FrequencyRow[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Học sinh</TableHead><TableHead>Số buổi</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.slice(0, 20).map((r) => (
          <TableRow key={r.studentId}><TableCell>{r.studentName}</TableCell><TableCell>{r.count}</TableCell></TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
