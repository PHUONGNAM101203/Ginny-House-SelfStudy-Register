"use client"

import { cn } from "@/lib/utils"
import type { TimeSlot } from "@/lib/time-slots"
import type { RegistrationRow } from "@/lib/schedule-data"

type SlotState = "free" | "booked" | "locked"

export function SlotCell({
  slot, state, registration, onClick,
}: { slot: TimeSlot; state: SlotState; registration?: RegistrationRow; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={`slot-${slot.start}`}
      onClick={onClick}
      disabled={state === "locked"}
      className={cn(
        "flex h-8 w-full items-center justify-center rounded-sm border text-xs transition-colors",
        state === "free" && "border-dashed border-muted-foreground/30 hover:bg-accent",
        state === "booked" && "cursor-pointer border-primary/30 bg-primary/10 text-primary",
        state === "locked" && "cursor-not-allowed border-none bg-muted text-muted-foreground/50"
      )}
      title={registration?.studentName}
    >
      {state === "booked" ? registration!.studentName.split(" ").at(-1) : state === "locked" ? "—" : ""}
    </button>
  )
}
