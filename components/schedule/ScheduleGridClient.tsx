"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import { BookingDialog } from "@/components/booking/BookingDialog"
import { BookingDetailDialog } from "@/components/booking/BookingDetailDialog"
import { RequestChangeDialog } from "@/components/booking/RequestChangeDialog"
import { GuestChatWidget, type GuestRegistration } from "@/components/chat/GuestChatWidget"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"
import { readMyRegistrationIds } from "@/lib/my-registrations"

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
  // Which bookings this browser made. The single `activeRegistration` above
  // only ever remembers the latest one, but a guest who booked three slots
  // should be able to open all three — so BookingDialog also appends every
  // id here (see MY_REGISTRATIONS_KEY).
  const [myIds, setMyIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    const raw = localStorage.getItem("activeRegistration")
    if (raw) setActiveRegistration(JSON.parse(raw))
    setMyIds(readMyRegistrationIds())
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
            setMyIds(readMyRegistrationIds())
            router.refresh()
          }}
        />
      )}
      {selected?.registration && !requestingChange && (
        <BookingDetailDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          audience={myIds.has(selected.registration.id) ? "guest-own" : "guest-other"}
          registrationId={selected.registration.id}
          deskLabel={selected.desk.label}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          studentName={selected.registration.studentName}
          className={selected.registration.className}
          recurringRegistrationId={selected.registration.recurringRegistrationId}
          onSuccess={() => router.refresh()}
          onRequestCancel={() => setRequestingChange(true)}
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
          studentName={selected.registration.studentName ?? ""}
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
