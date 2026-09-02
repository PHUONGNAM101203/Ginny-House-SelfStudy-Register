import type { CSSProperties } from "react"

/**
 * The three things a card on the calendar can be. Gin Anh asked for them to
 * be told apart at a glance rather than by reading a label — quản sinh
 * scanning the week shouldn't have to work out which bookings are still on.
 */
export type BookingKind = "normal" | "recurring" | "pending" | "cancelled"

export function bookingKind(registration: {
  status?: "active" | "cancelled"
  recurringRegistrationId: string | null
  recurringApproved?: boolean | null
}): BookingKind {
  if (registration.status === "cancelled") return "cancelled"
  if (!registration.recurringRegistrationId) return "normal"
  // Explicit false only: null/undefined means the caller didn't join the
  // rule (the guest calendar doesn't), and an unknown state must not be
  // drawn as "chờ duyệt".
  return registration.recurringApproved === false ? "pending" : "recurring"
}

export const BOOKING_KIND_LABEL: Record<BookingKind, string> = {
  normal: "Lịch bình thường",
  recurring: "Lịch cố định",
  pending: "Lịch chờ duyệt",
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
  // Neutral and dashed rather than a fourth hue: the palette only carries
  // blue, gold and red, and inventing an orange next to the gold one would
  // be the two hardest to tell apart. Dashed grey reads as "provisional" on
  // its own, before any colour registers, and holds up in both themes.
  pending: {
    backgroundColor: "color-mix(in oklch, var(--muted-foreground) 10%, var(--card))",
    color: "var(--muted-foreground)",
    border: "1px dashed color-mix(in oklch, var(--muted-foreground) 60%, transparent)",
  },
  cancelled: {
    backgroundColor: "color-mix(in oklch, var(--destructive) 12%, var(--card))",
    color: "var(--destructive)",
  },
}
