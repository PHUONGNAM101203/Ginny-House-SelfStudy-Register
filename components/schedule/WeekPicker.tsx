"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { addDays, format } from "date-fns"
import { Button } from "@/components/ui/button"

export function WeekPicker({ monday }: { monday: Date }) {
  const router = useRouter()
  const params = useSearchParams()

  function goTo(newMonday: Date) {
    const p = new URLSearchParams(params)
    p.set("week", format(newMonday, "yyyy-MM-dd"))
    router.push(`/?${p.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => goTo(addDays(monday, -7))}>← Tuần trước</Button>
      <span className="text-sm font-medium">Tuần {format(monday, "dd/MM/yyyy")}</span>
      <Button variant="outline" size="sm" onClick={() => goTo(addDays(monday, 7))}>Tuần sau →</Button>
    </div>
  )
}
