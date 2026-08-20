"use client"

import { useState } from "react"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export function ScheduleGridClient({
  desks, monday, registrations, locks,
}: { desks: Desk[]; monday: Date; registrations: RegistrationRow[]; locks: SlotLock[] }) {
  const [selected, setSelected] = useState<SlotClickPayload | null>(null)

  return (
    <>
      <ScheduleGrid desks={desks} monday={monday} registrations={registrations} locks={locks} onSlotClick={setSelected} />
      {/* BookingDialog / CancelDialog wired in Tasks 9-10, reading `selected` */}
    </>
  )
}
