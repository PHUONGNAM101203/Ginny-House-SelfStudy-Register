"use client"

import { useState } from "react"
import { CopyIcon, CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MissingStudent } from "@/lib/dashboard"

function formatForCopy(students: MissingStudent[]): string {
  return students
    .map((s) => `${s.studentName}${s.className ? ` - ${s.className}` : ""} - ${s.phone}`)
    .join("\n")
}

export function MissingRegistrationsList({ students }: { students: MissingStudent[] }) {
  const [copied, setCopied] = useState(false)

  if (students.length === 0) return <p className="text-sm text-muted-foreground">Mọi học sinh cố định đã đăng ký tuần này.</p>

  async function handleCopy() {
    await navigator.clipboard.writeText(formatForCopy(students))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-1.5">
        {students.map((s) => (
          <li key={s.studentId} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span className="font-medium">{s.studentName}</span>
            {s.className && <span className="text-muted-foreground">{s.className}</span>}
            <span className="text-muted-foreground">{s.phone}</span>
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="w-fit" onClick={handleCopy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? "Đã sao chép" : "Sao chép danh sách"}
      </Button>
    </div>
  )
}
