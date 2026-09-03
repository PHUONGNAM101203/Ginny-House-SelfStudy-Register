"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import type { Counted } from "@/lib/dashboard-stats"

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]

/**
 * Bookings per day as a count. Replaces the old occupancy chart, which
 * plotted a fill rate: 8% conveyed nothing about whether the week was busy.
 *
 * Colours come from `className`, not from `fill` / `stroke` props. Recharts
 * writes those as SVG presentation attributes, and CSS var() does not resolve
 * there — the first version of this chart drew no bars at all for exactly
 * that reason. Tailwind's fill and stroke utilities are real CSS, so they
 * follow the theme including dark mode.
 *
 * allowDecimals={false} matters too: recharts will otherwise label a y-axis
 * 0, 0.5, 1 when the tallest bar is 1, and half a booking does not exist.
 */
export function DailyCountChart({ rows }: { rows: Counted[] }) {
  const data = rows.map((row, index) => ({
    day: `${WEEKDAYS[index] ?? ""} ${row.label.slice(8)}/${row.label.slice(5, 7)}`,
    count: row.count,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <Tooltip
          cursor={{ fill: "color-mix(in oklch, var(--primary) 8%, transparent)" }}
          formatter={(v) => [`${v} lượt`, "Đăng ký"]}
        />
        {/* No entry animation: recharts animates from zero height, and on a
            throttled tab that animation can stall and leave the chart looking
            empty. The numbers are the point here, not the reveal. */}
        <Bar dataKey="count" className="fill-primary" radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}
