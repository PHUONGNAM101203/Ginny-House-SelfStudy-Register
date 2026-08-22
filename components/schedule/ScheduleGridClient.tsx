"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import { BookingDialog } from "@/components/booking/BookingDialog"
import { CancelDialog } from "@/components/booking/CancelDialog"
import { RequestChangeDialog } from "@/components/booking/RequestChangeDialog"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export function ScheduleGridClient({
  desks, date, registrations, locks,
}: { desks: Desk[]; date: string; registrations: RegistrationRow[]; locks: SlotLock[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<SlotClickPayload | null>(null)
  // Direct self-cancel (exact name/phone match) stays the fast path; this
  // switches to the lower-friction request-and-admin-approves flow instead
  // of closing the dialog outright — see CancelDialog's onRequestChangeInstead.
  const [requestingChange, setRequestingChange] = useState(false)

  function closeAll() {
    setSelected(null)
    setRequestingChange(false)
  }

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
      {selected?.registration && !requestingChange && (
        <CancelDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          registrationId={selected.registration.id}
          deskLabel={selected.desk.label}
          startTime={selected.startTime}
          endTime={selected.endTime}
          onSuccess={() => router.refresh()}
          onRequestChangeInstead={() => setRequestingChange(true)}
        />
      )}
      {selected?.registration && requestingChange && (
        <RequestChangeDialog
          open
          onOpenChange={(v) => !v && closeAll()}
          registrationId={selected.registration.id}
          deskLabel={selected.desk.label}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          studentName={selected.registration.studentName}
          className={selected.registration.className}
          desks={desks}
          registrations={registrations}
          locks={locks}
          onSuccess={() => {
            closeAll()
            router.refresh()
          }}
        />
      )}
    </>
  )
}
