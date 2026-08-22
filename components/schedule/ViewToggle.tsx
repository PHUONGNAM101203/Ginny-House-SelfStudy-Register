"use client"

import { useEffect, useOptimistic, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type ScheduleView = "day" | "week"

/**
 * Switches between the single-day booking grid and the week-at-a-glance
 * overview (see WeekOverview). Defaults to "day" on both mobile and desktop —
 * this is the toggle a visitor reaches for the overview, not a replacement
 * for it.
 */
export function ViewToggle({ view }: { view: ScheduleView }) {
  const router = useRouter()
  const params = useSearchParams()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [optimisticView, setOptimisticView] = useOptimistic(view)

  // Only two destinations ever exist, so warming both on mount costs little
  // and means the actual click almost always hits an already-fetched page.
  useEffect(() => {
    for (const v of ["day", "week"] as const) {
      const p = new URLSearchParams(params)
      p.set("view", v)
      router.prefetch(`${pathname}?${p.toString()}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function onChange(next: string) {
    const p = new URLSearchParams(params)
    p.set("view", next)
    const href = `${pathname}?${p.toString()}`
    startTransition(() => {
      setOptimisticView(next as ScheduleView)
      router.push(href)
    })
  }

  return (
    <Tabs value={optimisticView} onValueChange={onChange}>
      <TabsList>
        <TabsTrigger value="day">Ngày</TabsTrigger>
        <TabsTrigger value="week">Tuần</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
