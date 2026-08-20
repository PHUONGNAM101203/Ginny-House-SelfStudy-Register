"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import { BookingDialog } from "@/components/booking/BookingDialog"
import { CancelDialog } from "@/components/booking/CancelDialog"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export function ScheduleGridClient({
  desks, date, registrations, locks,
}: { desks: Desk[]; date: string; registrations: RegistrationRow[]; locks: SlotLock[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<SlotClickPayload | null>(null)

  return (
    <>
      <ScheduleGrid desks={desks} date={date} registrations={registrations} locks={locks} onSlotClick={setSelected} />
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
      {selected?.registration && (
        <CancelDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          registrationId={selected.registration.id}
          deskLabel={selected.desk.label}
          startTime={selected.startTime}
          endTime={selected.endTime}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  )
}
