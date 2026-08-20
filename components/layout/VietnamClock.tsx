"use client"

import { useEffect, useState } from "react"
import { ClockIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Always Asia/Ho_Chi_Minh, never the viewer's own zone: the clock exists so
// staff and students can see the time the schedule is expressed in, which is
// branch-local Vietnam time regardless of where the device is set.
const TIME_ZONE = "Asia/Ho_Chi_Minh"

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
})

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
})

/**
 * Live wall clock in Vietnam time, ticking once a second.
 *
 * Renders nothing on the server / first client paint: the time is by
 * definition different between the two, so rendering it during hydration would
 * be a guaranteed mismatch. A fixed-width placeholder holds the space so the
 * surrounding header does not jump when the first tick lands.
 */
export function VietnamClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const tick = () => setNow(new Date())
    // The first value is set from a timeout rather than straight from the
    // effect body: a synchronous setState in an effect triggers a cascading
    // render (and is flagged by react-hooks/set-state-in-effect). At 0ms the
    // placeholder is only on screen for a single frame.
    const firstTick = setTimeout(tick, 0)
    const interval = setInterval(tick, 1000)
    return () => {
      clearTimeout(firstTick)
      clearInterval(interval)
    }
  }, [])

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-muted-foreground",
        className
      )}
      // role="timer" + the default aria-live="off" means the value is
      // readable on demand but never announced on every tick, which would
      // make a screen reader unusable.
      role="timer"
      aria-live="off"
    >
      <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">Giờ Việt Nam</span>
      {/* min-w on both spans so the first tick swaps text in without resizing
          them — AppHeader row is flex-wrap and would otherwise reflow. */}
      <span className="hidden min-w-[5.25rem] text-xs font-medium sm:inline">
        {now ? dateFormatter.format(now) : " "}
      </span>
      <span className="min-w-[4.5rem] text-xs font-semibold tabular-nums text-foreground">
        {now ? timeFormatter.format(now) : "--:--:--"}
      </span>
    </div>
  )
}
