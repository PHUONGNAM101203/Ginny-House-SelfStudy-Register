"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import type { OccupancyRow } from "@/lib/dashboard"

export function OccupancyChart({ rows }: { rows: OccupancyRow[] }) {
  const byDate = Object.values(
    rows.reduce<Record<string, { date: string; booked: number; total: number }>>((acc, r) => {
      acc[r.date] ??= { date: r.date, booked: 0, total: 0 }
      acc[r.date].booked += r.bookedSlots
      acc[r.date].total += r.totalSlots
      return acc
    }, {})
  ).map((d) => ({ ...d, rate: d.total === 0 ? 0 : Math.round((d.booked / d.total) * 100) }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={byDate}>
        <XAxis dataKey="date" fontSize={12} />
        <YAxis unit="%" fontSize={12} />
        <Tooltip formatter={(v) => `${v}%`} />
        <Bar dataKey="rate" fill="#3b82f6" radius={4} />
      </BarChart>
    </ResponsiveContainer>
  )
}
