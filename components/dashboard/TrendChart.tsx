"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

/**
 * Bookings per week. `allowDecimals={false}` because recharts otherwise
 * labels the axis 0 / 0.5 / 1 on a quiet week, and half a booking is not a
 * thing. Colours come from the theme so the chart follows dark mode instead
 * of staying on a hard-coded blue.
 */
export function TrendChart({ points }: { points: { period: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
        <XAxis dataKey="period" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <Tooltip formatter={(v) => [`${v} lượt`, "Đăng ký"]} />
        {/* See DailyCountChart: var() does not resolve in SVG attributes, so
            the colour comes from a class. */}
        <Line
          type="monotone"
          dataKey="count"
          className="stroke-primary [&_.recharts-dot]:fill-primary"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
