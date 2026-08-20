"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import { BookingDialog } from "@/components/booking/BookingDialog"
import { createRegistrationAsAdminAction } from "@/actions/registrations"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export function InternalScheduleGridClient({
  desks, date, registrations, locks, canBook,
}: { desks: Desk[]; date: string; registrations: RegistrationRow[]; locks: SlotLock[]; canBook: boolean }) {
  const router = useRouter()
  const [selected, setSelected] = useState<SlotClickPayload | null>(null)

  return (
    <>
      <ScheduleGrid
        desks={desks} date={date} registrations={registrations} locks={locks}
        onSlotClick={canBook ? setSelected : () => {}}
      />
      {canBook && selected && !selected.registration && (
        <BookingDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          deskId={selected.desk.id}
          deskLabel={selected.desk.label}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          action={createRegistrationAsAdminAction}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  )
}
