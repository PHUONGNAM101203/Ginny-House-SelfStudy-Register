import type { CSSProperties } from "react"

/**
 * The three things a card on the calendar can be. Gin Anh asked for them to
 * be told apart at a glance rather than by reading a label — quản sinh
 * scanning the week shouldn't have to work out which bookings are still on.
 */
export type BookingKind = "normal" | "recurring" | "vacant" | "cancelled"

export function bookingKind(registration: {
  status?: "active" | "cancelled"
  studentId?: string | null
  recurringRegistrationId: string | null
}): BookingKind {
  if (registration.status === "cancelled") return "cancelled"
  // A vacant placeholder still holds the desk (status stays 'active') but has
  // nobody against it — migration 0034.
  if (registration.studentId === null) return "vacant"
  return registration.recurringRegistrationId ? "recurring" : "normal"
}

export const BOOKING_KIND_LABEL: Record<BookingKind, string> = {
  normal: "Lịch bình thường",
  recurring: "Lịch cố định",
  vacant: "Lịch cố định — còn trống",
  cancelled: "Lịch huỷ",
}

/**
 * Tinted fills rather than saturated ones: at a busy hour the grid is wall to
 * wall with these, and a solid block makes the name inside unreadable. Text
 * carries the hue instead. Kept in one place so the week overview, the day
 * grid and the legend can never drift apart.
 *
 * `--gold` is yellow-500, which fails contrast as text, so the recurring
 * variant writes in --gold-foreground (yellow-800) over a gold tint.
 */
export const BOOKING_KIND_STYLE: Record<BookingKind, CSSProperties> = {
  normal: {
    backgroundColor: "color-mix(in oklch, var(--primary) 12%, var(--card))",
    color: "var(--primary)",
  },
  recurring: {
    backgroundColor: "color-mix(in oklch, var(--gold) 22%, var(--card))",
    color: "var(--gold-foreground)",
  },
  // Dashed and drained of colour: the desk is still reserved every week, but
  // nobody holds it — visibly different from both a live booking and a plain
  // free cell, which is the entire point of keeping the card.
  vacant: {
    backgroundColor: "color-mix(in oklch, var(--gold) 8%, var(--card))",
    color: "var(--muted-foreground)",
    border: "1px dashed color-mix(in oklch, var(--gold) 55%, transparent)",
  },
  // Grey, not red: red reads as an alarm, and a cancellation is just a
  // record of something that is no longer happening. Gin Anh asked for it
  // toned down.
  cancelled: {
    backgroundColor: "color-mix(in oklch, var(--muted-foreground) 10%, var(--card))",
    color: "var(--muted-foreground)",
  },
}
