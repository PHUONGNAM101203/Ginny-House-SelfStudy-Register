"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import { BookingDialog } from "@/components/booking/BookingDialog"
import { CancelDialog } from "@/components/booking/CancelDialog"
import { RequestChangeDialog } from "@/components/booking/RequestChangeDialog"
import { GuestChatWidget, type GuestRegistration } from "@/components/chat/GuestChatWidget"
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

  // Read once on mount, not during render — localStorage doesn't exist
  // during SSR. Set by BookingDialog right after a successful booking.
  const [activeRegistration, setActiveRegistration] = useState<GuestRegistration | null>(null)
  useEffect(() => {
    const raw = localStorage.getItem("activeRegistration")
    if (raw) setActiveRegistration(JSON.parse(raw))
  }, [])

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
          onSuccess={() => {
            // localStorage was already written by BookingDialog itself
            // (see its onSubmit) — re-read here so the widget appears
            // immediately without waiting for a full page reload.
            const raw = localStorage.getItem("activeRegistration")
            if (raw) setActiveRegistration(JSON.parse(raw))
            router.refresh()
          }}
        />
      )}
      {selected?.registration && !requestingChange && (
        <CancelDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          deskLabel={selected.desk.label}
          startTime={selected.startTime}
          endTime={selected.endTime}
          isRecurring={selected.registration.recurringRegistrationId !== null}
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
      {activeRegistration && <GuestChatWidget registration={activeRegistration} />}
    </>
  )
}
