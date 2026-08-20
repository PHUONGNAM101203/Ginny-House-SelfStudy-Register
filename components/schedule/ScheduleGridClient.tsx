"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import { BookingDialog } from "@/components/booking/BookingDialog"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export function ScheduleGridClient({
  desks, monday, registrations, locks,
}: { desks: Desk[]; monday: Date; registrations: RegistrationRow[]; locks: SlotLock[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<SlotClickPayload | null>(null)

  return (
    <>
      <ScheduleGrid desks={desks} monday={monday} registrations={registrations} locks={locks} onSlotClick={setSelected} />
      {selected && !selected.registration && (
        <BookingDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          deskId={selected.desk.id}
          deskLabel={selected.desk.label}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  )
}
