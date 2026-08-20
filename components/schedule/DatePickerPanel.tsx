"use client"

import * as React from "react"
import { format, setYear, startOfMonth } from "date-fns"
import { vi } from "date-fns/locale"
import { ChevronLeftIcon } from "lucide-react"
import type { MonthCaptionProps } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  clampMonth,
  isMonthOutOfRange,
  monthsOfYear,
  yearsInRange,
} from "@/lib/date-picker-range"
import { cn } from "@/lib/utils"

/**
 * Which of the three views the panel is showing. The month and year views
 * REPLACE the day grid inside the same popover rather than opening next to it.
 *
 * This is the whole point of the component. The previous picker was a stock
 * shadcn `<Calendar captionLayout="dropdown">`, which renders the month and
 * year pickers as two native `<select>` elements laid invisibly
 * (`opacity: 0`, `position: absolute`) over the caption labels. A native
 * select's popup list is an OS-drawn widget: it is not part of the document,
 * so it is outside the popover's stacking context and outside CSS control
 * entirely — which is why it was observed rendering off to the side, over
 * unrelated page content. Nothing about z-index or portalling could have
 * fixed that; the select had to go.
 */
type PickerMode = "day" | "month" | "year"

/**
 * The contents of the date picker popover: a day grid whose month and year
 * labels each swap the whole panel to a month grid / year grid, the way
 * Google Calendar's and Apple Calendar's date pickers do.
 *
 * Rendered inside a `<PopoverContent>` of a fixed width, and every view fills
 * that width, so switching views never resizes or repositions the popover.
 *
 * State is intentionally not lifted or persisted: Radix unmounts popover
 * content on close, so each open starts fresh on the day grid at the selected
 * date — reopening the picker never lands the user in a month grid they left
 * behind from last time.
 */
export function DatePickerPanel({
  selected,
  rangeStart,
  rangeEnd,
  onSelect,
}: {
  /** The currently shown day; the panel opens on its month. */
  selected: Date
  /** Inclusive bounds — the same window lib/schedule-params.ts clamps to. */
  rangeStart: Date
  rangeEnd: Date
  onSelect: (date: Date) => void
}) {
  const [mode, setMode] = React.useState<PickerMode>("day")
  // Clamped even though `selected` is in-window for every current caller: this
  // is the one path into `viewMonth` that does not go through clampMonth, and
  // react-day-picker would quietly clamp the *display* without telling us,
  // leaving viewMonth and the rendered month disagreeing about which cell to
  // highlight.
  const [viewMonth, setViewMonth] = React.useState(() =>
    clampMonth(startOfMonth(selected), rangeStart, rangeEnd)
  )

  // Keyed on the timestamps, not the Date objects: the caller builds fresh
  // Dates every render, so memoising on identity would never hit.
  const rangeStartMs = rangeStart.getTime()
  const rangeEndMs = rangeEnd.getTime()
  const years = React.useMemo(
    () => yearsInRange(new Date(rangeStartMs), new Date(rangeEndMs)),
    [rangeStartMs, rangeEndMs]
  )

  // Swapping view unmounts the button that was just clicked, and this popover
  // is non-modal (no Radix focus trap), so without this focus would fall all
  // the way back to <body> — leaving a keyboard user tabbing from the top of
  // the document with an open popover still on screen.
  const gridRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (mode === "day") return
    const grid = gridRef.current
    if (!grid) return
    const current = grid.querySelector<HTMLButtonElement>('[aria-current="true"]')
    ;(current ?? grid.querySelector<HTMLButtonElement>("button:not(:disabled)"))?.focus()
  }, [mode])

  // The month/year labels in the day view's caption. Memoised so the object
  // identity is stable: react-day-picker treats `components` as a render
  // input, and a fresh object every render would remount the caption (and
  // drop focus from whichever label the keyboard was on).
  const components = React.useMemo(
    () => ({
      // Only `className`, `style` and `children` are used; `calendarMonth` and
      // `displayIndex` are react-day-picker's own and must not reach the DOM.
      MonthCaption: ({ calendarMonth, className, style, children }: MonthCaptionProps) => (
        // `className` carries ui/calendar.tsx's own month_caption layout
        // (the px-(--cell-size) gutters that keep the prev/next arrows clear),
        // so it is kept and only the gap is added.
        <div className={cn(className, "gap-1")} style={style}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 font-medium capitalize"
            aria-label={`Chọn tháng — đang xem ${format(calendarMonth.date, "LLLL yyyy", { locale: vi })}`}
            onClick={() => setMode("month")}
          >
            {format(calendarMonth.date, "LLLL", { locale: vi })}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 font-medium tabular-nums"
            aria-label={`Chọn năm — đang xem ${format(calendarMonth.date, "yyyy")}`}
            onClick={() => setMode("year")}
          >
            {format(calendarMonth.date, "yyyy")}
          </Button>
          {/* react-day-picker passes its `role="status" aria-live="polite"`
              caption label as this component's children. Replacing the caption
              with the two buttons above would drop it, and with it the only
              announcement a screen reader gets when the prev/next arrows move
              the month — so it is kept, visually hidden. */}
          <span className="sr-only">{children}</span>
        </div>
      ),
    }),
    []
  )

  if (mode === "day") {
    return (
      <Calendar
        mode="single"
        locale={vi}
        weekStartsOn={1}
        selected={selected}
        // Controlled: the month/year views drive this, so picking "Tháng 3"
        // has to move the day grid rather than only the internal default.
        month={viewMonth}
        onMonthChange={setViewMonth}
        // Bounded to exactly the window lib/schedule-params.ts clamps to, so
        // the picker can never offer a date the server bounces back to today.
        // startMonth/endMonth are month-granular, hence the `disabled` matcher
        // for the partial first/last months.
        startMonth={rangeStart}
        endMonth={rangeEnd}
        disabled={{ before: rangeStart, after: rangeEnd }}
        onSelect={(date) => {
          if (!date) return
          onSelect(date)
        }}
        autoFocus
        className="w-full p-0"
        components={components}
      />
    )
  }

  const gridLabel = mode === "month" ? "Chọn tháng" : "Chọn năm"

  return (
    <div className="flex flex-col gap-3">
      {/* Header mirrors the day view's caption bar so the panel does not jump
          between views: same height, back control on the left where the
          prev-month arrow sits. Escape closes the whole popover, so without an
          explicit way back a user who opened the month grid by mistake would
          have to either commit to a month or lose their place entirely. */}
      <div className="flex h-9 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Quay lại lưới ngày"
          onClick={() => setMode("day")}
        >
          <ChevronLeftIcon />
        </Button>
        <div className="flex flex-1 items-center justify-center">
          {mode === "month" ? (
            // In the month view the label is the year, and clicking it goes
            // one level further out to the year grid — the same drill-up
            // Google Calendar's picker has.
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 font-medium tabular-nums"
              aria-label={`Chọn năm — đang xem ${format(viewMonth, "yyyy")}`}
              onClick={() => setMode("year")}
            >
              {format(viewMonth, "yyyy")}
            </Button>
          ) : (
            <span className="text-sm font-medium">{gridLabel}</span>
          )}
        </div>
        {/* Balances the back button so the label stays optically centred. */}
        <span aria-hidden className="size-8" />
      </div>

      {/* max-h + overflow-y-auto: the year list is only five entries under the
          current ±2-year bound, but this keeps the popover a sane height (and
          every entry reachable) if that bound is ever widened. */}
      <div
        ref={gridRef}
        role="group"
        aria-label={gridLabel}
        className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto"
      >
        {mode === "month"
          ? monthsOfYear(viewMonth).map((month) => {
              const outOfRange = isMonthOutOfRange(month, rangeStart, rangeEnd)
              const isCurrent = month.getMonth() === viewMonth.getMonth()
              return (
                <Button
                  key={month.getMonth()}
                  type="button"
                  variant={isCurrent ? "default" : "ghost"}
                  size="sm"
                  disabled={outOfRange}
                  // aria-current, not aria-pressed: these are single-select
                  // choices, not toggles — clicking one never un-picks it.
                  aria-current={isCurrent ? "true" : undefined}
                  className="h-9 w-full font-normal capitalize"
                  onClick={() => {
                    setViewMonth(clampMonth(month, rangeStart, rangeEnd))
                    setMode("day")
                  }}
                >
                  {format(month, "LLL", { locale: vi })}
                </Button>
              )
            })
          : years.map((year) => {
              // No out-of-range check here: yearsInRange builds the list from
              // the bounds themselves, so every year listed contains at least
              // one selectable day by construction.
              const isCurrent = year === viewMonth.getFullYear()
              return (
                <Button
                  key={year}
                  type="button"
                  variant={isCurrent ? "default" : "ghost"}
                  size="sm"
                  aria-current={isCurrent ? "true" : undefined}
                  className="h-9 w-full font-normal tabular-nums"
                  onClick={() => {
                    setViewMonth(
                      clampMonth(startOfMonth(setYear(viewMonth, year)), rangeStart, rangeEnd)
                    )
                    // Back to the day grid rather than on to the month grid:
                    // the year label is reachable from the day view in one
                    // click, so a user who also wants a different month is one
                    // click away, while one who only wanted the year is done.
                    setMode("day")
                  }}
                >
                  {year}
                </Button>
              )
            })}
      </div>
    </div>
  )
}
