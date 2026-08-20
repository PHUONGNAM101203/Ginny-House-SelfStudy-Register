"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { addDays, addYears, format } from "date-fns"
import { vi } from "date-fns/locale"
import { CalendarIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DatePickerPanel } from "@/components/schedule/DatePickerPanel"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MAX_YEARS_FROM_TODAY } from "@/lib/schedule-params"
import { getMondayOfWeek, getWeekDates } from "@/lib/week"
import { parseYmd, toYmd, vietnamToday } from "@/lib/vn-date"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

/**
 * Day navigation for the schedule grid: a Today button, prev/next day steps, a
 * clickable date label that opens a month/year date picker, and a strip of the
 * seven days in the currently loaded week.
 *
 * Deliberately an external control rather than react-big-calendar's own
 * `components.toolbar` override. RBC's toolbar renders *inside* each Calendar
 * instance, and this grid stacks two instances per day (morning 08-12 +
 * afternoon 14-22, because RBC cannot show one range with a gap). A native
 * toolbar would therefore either render twice or sit visually attached to the
 * morning block only — and, more concretely, it would live inside the
 * horizontally scrolling desk-column container, so on a phone the nav would
 * scroll sideways off screen with the grid. Keeping it outside that container
 * is what lets the toolbar stay put while only the grid scrolls.
 */
export function DateNavigator({
  selectedDate: selectedDateStr,
  leading,
}: {
  /** "yyyy-MM-dd" — a calendar day, not an instant (see lib/vn-date.ts). */
  selectedDate: string
  /** Rendered at the start of the controls row (the branch tabs). */
  leading?: React.ReactNode
}) {
  const router = useRouter()
  const params = useSearchParams()
  // Mounted by both "/" and "/noi-bo/lich" — never hardcode the target path,
  // or a staff member gets ejected from the internal shell on every nav.
  const pathname = usePathname()
  const [pickerOpen, setPickerOpen] = useState(false)

  // Rebuilt as *local* midnight on whichever side is rendering. Both sides
  // start from the same string, so SSR and hydration always agree.
  const selectedDate = parseYmd(selectedDateStr)
  // "Today" is Vietnam's today, not the device's — the branch's day is the one
  // that matters, and it must match the clock in the header.
  const todayStr = vietnamToday()
  const weekDates = getWeekDates(getMondayOfWeek(selectedDate))

  function goTo(date: Date) {
    const next = new URLSearchParams(params)
    next.set("day", toYmd(date))
    // `week` is what getScheduleData still fetches by, so it is always written
    // alongside `day`: jumping to a date in another week re-fetches that week
    // without any extra client round trip.
    next.set("week", toYmd(getMondayOfWeek(date)))
    router.push(`${pathname}?${next.toString()}`)
  }

  const isToday = selectedDateStr === todayStr
  const rangeStart = addYears(parseYmd(todayStr), -MAX_YEARS_FROM_TODAY)
  const rangeEnd = addYears(parseYmd(todayStr), MAX_YEARS_FROM_TODAY)

  return (
    // Two stacked rows up to `xl`, one row from `xl` up. On a wide screen the
    // stacked form left the whole bottom-right of the toolbar empty — the week
    // strip is capped (see its own comment) so it cannot fill that band itself.
    // At `xl` the wrapper below becomes `display: contents`, which dissolves it
    // so its two children and the week strip all become items of this one flex
    // row; `order-1/2/3` then puts them tabs | strip | controls.
    <div className="flex w-full min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 xl:contents">
        {/* Rendered only when there is something to put in it. An always-present
            empty wrapper would be a zero-width first child, and `justify-between`
            would then shove the day controls to the right edge — which is what
            a database with no branches yet would have looked like. */}
        {leading && <div className="min-w-0 xl:order-1">{leading}</div>}
        <div className="flex flex-wrap items-center gap-2 xl:order-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goTo(parseYmd(todayStr))}
            disabled={isToday}
            aria-label="Về hôm nay"
          >
            Hôm nay
          </Button>

          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon-sm" onClick={() => goTo(addDays(selectedDate, -1))} aria-label="Ngày trước">
              <ChevronLeftIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => goTo(addDays(selectedDate, 1))} aria-label="Ngày sau">
              <ChevronRightIcon />
            </Button>
          </div>

          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              {/* The label names the selected date as well as the action: an
                  aria-label REPLACES the button's text, so a bare "Chọn ngày"
                  would hide which day the grid is showing (WCAG 2.5.3). */}
              <Button
                variant="outline"
                size="sm"
                className="min-w-0 font-semibold"
                aria-label={`Chọn ngày — đang xem ${format(selectedDate, "EEEE dd/MM/yyyy", { locale: vi })}`}
              >
                <CalendarIcon data-icon="inline-start" />
                <span className="truncate capitalize">{format(selectedDate, "EEEE, dd/MM/yyyy", { locale: vi })}</span>
                <ChevronDownIcon data-icon="inline-end" />
              </Button>
            </PopoverTrigger>
            {/* Fixed width (the PopoverContent default) rather than w-auto:
                the panel swaps between a day grid, a month grid and a year
                grid, and a shrink-to-fit popover would resize and re-anchor
                itself on every swap. */}
            <PopoverContent align="end" className="p-2">
              <DatePickerPanel
                selected={selectedDate}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                onSelect={(date) => {
                  setPickerOpen(false)
                  goTo(date)
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Week strip: every day here is already in the fetched week, so these
          are the cheap jumps. Kept on all widths — it is the fastest way to
          switch days and it keeps the week context the data layer works in
          visible now that the grid itself only shows one day. */}
      {/* max-w-xl: full width on a phone, but capped on desktop so the seven
          cells stay a compact strip instead of stretching into huge blocks. */}
      <div
        // xl:min-w-56 floors the strip at its seven size-8 discs: grid-cols-7
        // is minmax(0,1fr), so a flex-1 track with no floor could be squeezed
        // narrower than its own content and the discs would overlap.
        className="grid w-full max-w-xl grid-cols-7 gap-1 xl:order-2 xl:min-w-56 xl:flex-1"
        role="group"
        aria-label="Chọn ngày trong tuần"
      >
        {weekDates.map((date) => {
          const dateStr = toYmd(date)
          const selected = dateStr === selectedDateStr
          const isCurrentDay = dateStr === todayStr
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => goTo(date)}
              aria-pressed={selected}
              // "Today" is otherwise conveyed by colour + weight alone.
              aria-current={isCurrentDay ? "date" : undefined}
              aria-label={format(date, "EEEE dd/MM/yyyy", { locale: vi })}
              className="group/day flex flex-col items-center gap-1 rounded-md py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-[0.65rem] font-semibold text-muted-foreground uppercase">
                {WEEKDAY_LABELS[(date.getDay() + 6) % 7]}
              </span>
              {/* The highlight is a fixed-size disc, not the whole cell, so it
                  looks identical whatever width the strip is given. */}
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                  "transition-[background-color,color,transform] duration-[var(--dur-fast)] ease-[var(--ease-out)]",
                  "group-active/day:translate-y-px",
                  selected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "group-hover/day:bg-muted",
                  !selected && isCurrentDay && "font-bold text-primary"
                )}
              >
                {format(date, "d")}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
