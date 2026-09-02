import { BOOKING_KIND_LABEL, BOOKING_KIND_STYLE, type BookingKind } from "@/lib/booking-kind"

const ORDER: BookingKind[] = ["normal", "recurring", "pending", "cancelled"]

/**
 * Three tinted chips can only be read at a glance once you know what the
 * tints mean. Internal pages only — a guest never sees a cancelled card, so
 * a legend naming one would describe something they can't encounter.
 */
export function ScheduleLegend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
      {ORDER.map((kind) => (
        <span
          key={kind}
          className="rounded-md px-2 py-1 font-medium"
          style={BOOKING_KIND_STYLE[kind]}
        >
          {BOOKING_KIND_LABEL[kind]}
        </span>
      ))}
    </div>
  )
}
