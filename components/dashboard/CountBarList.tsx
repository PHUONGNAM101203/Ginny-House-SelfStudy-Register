import type { Counted } from "@/lib/dashboard-stats"

/**
 * A ranked list where the bar is the number, not a percentage — the width is
 * relative to the busiest row purely so the eye can compare, while the figure
 * itself is always the real count.
 */
export function CountBarList({
  rows,
  emptyMessage,
  formatLabel,
}: {
  rows: Counted[]
  emptyMessage: string
  formatLabel?: (label: string) => string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }
  const max = Math.max(...rows.map((r) => r.count), 1)

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm">{formatLabel ? formatLabel(row.label) : row.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${Math.max((row.count / max) * 100, 4)}%` }}
            />
          </span>
          <span className="w-10 shrink-0 text-right text-sm font-medium tabular-nums">{row.count}</span>
        </li>
      ))}
    </ul>
  )
}
