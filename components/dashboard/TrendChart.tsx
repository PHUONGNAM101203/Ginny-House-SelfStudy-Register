"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

export function TrendChart({ points }: { points: { period: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points}>
        <XAxis dataKey="period" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
