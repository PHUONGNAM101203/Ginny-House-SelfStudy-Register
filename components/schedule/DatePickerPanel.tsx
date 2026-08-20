"use client"

import * as React from "react"
import {
  endOfMonth,
  endOfYear,
  format,
  isAfter,
  isBefore,
  setMonth,
  setYear,
  startOfMonth,
  startOfYear,
} from "date-fns"
import { vi } from "date-fns/locale"
import type { MonthCaptionProps } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

/** 0-11 → the twelve month buttons, laid out 3 across. */
const MONTH_INDEXES = Array.from({ length: 12 }, (_, i) => i)

function clampMonth(month: Date, rangeStart: Date, rangeEnd: Date): Date {
  const min = startOfMonth(rangeStart)
  const max = startOfMonth(rangeEnd)
  if (isBefore(month, min)) return min
  if (isAfter(month, max)) return max
  return month
}

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
  const [viewMonth, setViewMonth] = React.useState(() => startOfMonth(selected))

  const years = React.useMemo(() => {
    const first = rangeStart.getFullYear()
    const last = rangeEnd.getFullYear()
    return Array.from({ length: last - first + 1 }, (_, i) => first + i)
  }, [rangeStart, rangeEnd])

  // The month/year labels in the day view's caption. Memoised so the object
  // identity is stable: react-day-picker treats `components` as a render
  // input, and a fresh object every render would remount the caption (and
  // drop focus from whichever label the keyboard was on).
  const components = React.useMemo(
    () => ({
      // Only `className` and `style` are taken from the props react-day-picker
      // passes here; the rest (`calendarMonth`, `displayIndex`,
      // `data-animated-caption`) are deliberately not spread onto the div —
      // the first two are not DOM attributes, and the default children are the
      // static caption label these two buttons replace.
      MonthCaption: ({ calendarMonth, className, style }: MonthCaptionProps) => (
        // `className` carries ui/calendar.tsx's own month_caption layout
        // (the px-(--cell-size) gutters that keep the prev/next arrows clear),
        // so it is kept and only the gap is added.
        <div className={cn(className, "gap-1")} style={style}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 font-medium capitalize"
            aria-label={`Chọn tháng — đang xem ${format(calendarMonth.date, "LLLL yyyy", { locale: vi })}`}
            onClick={() => setMode("month")}
          >
            {format(calendarMonth.date, "LLLL", { locale: vi })}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 font-medium tabular-nums"
            aria-label={`Chọn năm — đang xem ${format(calendarMonth.date, "yyyy")}`}
            onClick={() => setMode("year")}
          >
            {format(calendarMonth.date, "yyyy")}
          </Button>
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
        classNames={{ root: "w-full" }}
        components={components}
      />
    )
  }

  const gridLabel = mode === "month" ? "Chọn tháng" : "Chọn năm"

  return (
    <div className="flex flex-col gap-3" aria-label={gridLabel}>
      {/* Header mirrors the day view's caption bar so the panel does not jump
          between views: same height, same centred label. In the month view the
          label is the year, and clicking it goes one level further out to the
          year grid — the same drill-up Google Calendar's picker has. */}
      <div className="flex h-9 items-center justify-center">
        {mode === "month" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 font-medium tabular-nums"
            aria-label={`Chọn năm — đang xem ${format(viewMonth, "yyyy")}`}
            onClick={() => setMode("year")}
          >
            {format(viewMonth, "yyyy")}
          </Button>
        ) : (
          <span className="text-sm font-medium">{gridLabel}</span>
        )}
      </div>

      {/* max-h + overflow-y-auto: the year list is only five entries under the
          current ±2-year bound, but this keeps the popover a sane height (and
          every entry reachable) if that bound is ever widened. */}
      <div
        role="group"
        aria-label={gridLabel}
        className="grid max-h-64 grid-cols-3 gap-1.5 overflow-y-auto"
      >
        {mode === "month"
          ? MONTH_INDEXES.map((index) => {
              const month = setMonth(startOfYear(viewMonth), index)
              // Disabled only when the month is *entirely* outside the window
              // — a partially-in-range month still has selectable days, and
              // the day grid's own `disabled` matcher handles the rest.
              const outOfRange =
                isBefore(endOfMonth(month), rangeStart) || isAfter(startOfMonth(month), rangeEnd)
              const isCurrent = index === viewMonth.getMonth()
              return (
                <Button
                  key={index}
                  type="button"
                  variant={isCurrent ? "default" : "ghost"}
                  size="sm"
                  disabled={outOfRange}
                  aria-pressed={isCurrent}
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
              const candidate = setYear(viewMonth, year)
              const outOfRange =
                isBefore(endOfYear(candidate), rangeStart) || isAfter(startOfYear(candidate), rangeEnd)
              const isCurrent = year === viewMonth.getFullYear()
              return (
                <Button
                  key={year}
                  type="button"
                  variant={isCurrent ? "default" : "ghost"}
                  size="sm"
                  disabled={outOfRange}
                  aria-pressed={isCurrent}
                  className="h-9 w-full font-normal tabular-nums"
                  onClick={() => {
                    setViewMonth(clampMonth(startOfMonth(candidate), rangeStart, rangeEnd))
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
