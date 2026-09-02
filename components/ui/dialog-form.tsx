"use client"

import type { FormEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The guest-facing dialogs got Enter-to-submit for free because they happen
 * to be built on react-hook-form's <form>. Every admin dialog was hand-rolled
 * as a plain <div> plus an onClick button instead, so Enter did nothing there
 * — you had to reach for the mouse to save a branch, a desk, a student.
 *
 * This gives those dialogs the same native behaviour without dragging them
 * onto react-hook-form. Wrap the body AND the DialogFooter (the submit button
 * has to live inside the form for Enter to reach it), and use
 * `<Button type="submit">` in the footer.
 *
 * `grid gap-4` mirrors DialogContent's own layout, so inserting this wrapper
 * between them leaves the spacing exactly as it was.
 */
export function DialogForm({
  onSubmit,
  className,
  children,
}: {
  /** Return value is ignored — several handlers `return toast.error(...)`. */
  onSubmit: () => unknown
  className?: string
  children: ReactNode
}) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className={cn("grid gap-4", className)}>
      {children}
    </form>
  )
}
