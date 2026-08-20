import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * A native `<select>` wearing the same box as `<Input>`.
 *
 * Deliberately native rather than the Radix `Select` in ui/select.tsx: these
 * are short, static option lists in admin forms, and a native control gets the
 * platform's own picker (a full-height wheel on a phone) for free.
 *
 * The point of the component is that the styling lives in one place. The admin
 * forms previously each inlined `className="rounded border px-2 py-2"`, which
 * matched neither `<Input>`'s height nor its radius, border colour or focus
 * ring — so a row of controls came out visibly mismatched.
 *
 * Full width by default and auto-width from `sm` up: a bare native select
 * sizes itself to its widest option, which on a 320px screen pushed its own
 * label under the dropdown arrow. Stacking full-width on a phone and only
 * going inline once there is room avoids that at every width.
 */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-8 w-full min-w-0 max-w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm sm:w-auto dark:bg-input/30 dark:disabled:bg-input/80",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
