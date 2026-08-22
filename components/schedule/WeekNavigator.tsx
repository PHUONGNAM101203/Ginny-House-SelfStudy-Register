"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { addWeeks, format } from "date-fns"
import { vi } from "date-fns/locale"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMondayOfWeek, getWeekDates } from "@/lib/week"
import { parseYmd, toYmd, vietnamToday } from "@/lib/vn-date"

/**
 * Week-to-week navigation for the overview (see WeekOverview) — the week
 * equivalent of DateNavigator's day controls. Kept as its own component
 * rather than folded into DateNavigator: that component's day-strip and date
 * picker have no equivalent here, and threading a view-mode switch through
 * its render would double its complexity for a feature that only overlaps in
 * name.
 */
export function WeekNavigator({ monday }: { monday: Date }) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()

  const weekDates = getWeekDates(monday)
  const currentMonday = getMondayOfWeek(parseYmd(vietnamToday()))
  const isCurrentWeek = toYmd(monday) === toYmd(currentMonday)

  function goToWeek(newMonday: Date) {
    const p = new URLSearchParams(params)
    // `day` is day-view state — carrying it over would make week navigation
    // a no-op, since resolveScheduleDates prefers `day` over `week` whenever
    // both are present.
    p.delete("day")
    p.set("week", toYmd(newMonday))
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => goToWeek(currentMonday)} disabled={isCurrentWeek}>
        Tuần này
      </Button>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon-sm" onClick={() => goToWeek(addWeeks(monday, -1))} aria-label="Tuần trước">
          <ChevronLeftIcon />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={() => goToWeek(addWeeks(monday, 1))} aria-label="Tuần sau">
          <ChevronRightIcon />
        </Button>
      </div>
      <span className="text-sm font-semibold">
        {format(weekDates[0], "dd/MM", { locale: vi })} – {format(weekDates[6], "dd/MM/yyyy", { locale: vi })}
      </span>
    </div>
  )
}
