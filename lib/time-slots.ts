export type TimeSlot = { start: string; end: string }

const SLOT_MINUTES = 30
const RANGES: [string, string][] = [
  ["08:00", "12:00"],
  ["14:00", "22:00"],
]

function generateSlots(start: string, end: string): TimeSlot[] {
  const slots: TimeSlot[] = []
  let [h, m] = start.split(":").map(Number)
  const [endH, endM] = end.split(":").map(Number)
  while (h < endH || (h === endH && m < endM)) {
    const startStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    m += SLOT_MINUTES
    if (m >= 60) {
      m -= 60
      h += 1
    }
    const endStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
    slots.push({ start: startStr, end: endStr })
  }
  return slots
}

export const TIME_SLOTS: TimeSlot[] = RANGES.flatMap(([start, end]) => generateSlots(start, end))
