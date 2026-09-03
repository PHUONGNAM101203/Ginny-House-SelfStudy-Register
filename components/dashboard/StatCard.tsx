import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * One headline number. Deliberately a raw count rather than a rate — a
 * percentage tells you the shape of the week but never how many buổi that
 * actually is, which is the thing being managed.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string
  value: number | string
  hint?: string
  icon?: ReactNode
  tone?: "default" | "primary" | "gold" | "muted"
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border border-border bg-card p-4",
        tone === "primary" && "border-primary/30 bg-primary/5"
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "font-heading text-2xl font-semibold tabular-nums",
          tone === "primary" && "text-primary",
          tone === "gold" && "text-gold-foreground",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </p>
      {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
