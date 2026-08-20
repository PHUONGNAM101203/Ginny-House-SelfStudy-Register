"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { addDays, format } from "date-fns"
import { Button } from "@/components/ui/button"

export function WeekPicker({ monday }: { monday: Date }) {
  const router = useRouter()
  const params = useSearchParams()
  // This component is mounted by both the public guest page ("/") and the
  // internal staff calendar ("/noi-bo/lich"). Hardcoding "/" here ejected a
  // logged-in staff member out of the internal shell on every week change, so
  // always navigate back to whatever path we're currently rendered under.
  const pathname = usePathname()

  function goTo(newMonday: Date) {
    const p = new URLSearchParams(params)
    p.set("week", format(newMonday, "yyyy-MM-dd"))
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => goTo(addDays(monday, -7))}>← Tuần trước</Button>
      <span className="text-sm font-medium">Tuần {format(monday, "dd/MM/yyyy")}</span>
      <Button variant="outline" size="sm" onClick={() => goTo(addDays(monday, 7))}>Tuần sau →</Button>
    </div>
  )
}
