import type { MissingStudent } from "@/lib/dashboard"

export function MissingRegistrationsList({ students }: { students: MissingStudent[] }) {
  if (students.length === 0) return <p className="text-sm text-muted-foreground">Mọi học sinh cố định đã đăng ký tuần này.</p>
  return (
    <ul className="flex flex-col gap-1">
      {students.map((s) => (
        <li key={s.studentId} className="text-sm">{s.studentName}</li>
      ))}
    </ul>
  )
}
