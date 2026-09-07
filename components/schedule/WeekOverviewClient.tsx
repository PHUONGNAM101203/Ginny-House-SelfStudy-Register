"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { WeekOverview, type WeekBookingClick } from "@/components/schedule/WeekOverview"
import { BookingDetailDialog } from "@/components/booking/BookingDetailDialog"
import { BookingDialog } from "@/components/booking/BookingDialog"
import { RequestChangeDialog } from "@/components/booking/RequestChangeDialog"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"
import { readMyRegistrationIds } from "@/lib/my-registrations"

/**
 * Guest week view. A guest only ever sees the details of a booking this
 * browser made:
 *
 *   own booking        full details, and a huỷ that goes to the admin as a phiếu
 *   cancelled booking  the slot is free again — straight into the booking form
 *   anyone else's      no details; just says the slot is taken
 *
 * No phoneByStudentId here, ever — this page fetches with the anon client and
 * a guest must not see another guest's SĐT.
 */
export function WeekOverviewClient({
  desks,
  registrations,
  locks,
  weekDates,
  branchId,
}: {
  desks: Desk[]
  registrations: RegistrationRow[]
  locks: SlotLock[]
  weekDates: string[]
  branchId?: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<WeekBookingClick | null>(null)
  const [requestingChange, setRequestingChange] = useState(false)

  // Read on mount, not during render — localStorage doesn't exist during SSR.
  const [myIds, setMyIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    setMyIds(readMyRegistrationIds())
  }, [])

  const cancelled = selected?.registration.status === "cancelled"

  function closeAll() {
    setSelected(null)
    setRequestingChange(false)
  }

  function handleClick(payload: WeekBookingClick) {
    // Someone else's live booking: none of it is a guest's business, and a
    // dialog that only says "taken" is a dialog for nothing.
    if (payload.registration.status !== "cancelled" && !myIds.has(payload.registration.id)) {
      toast("Chỗ này đã có bạn khác đăng ký.")
      return
    }
    setRequestingChange(false)
    setSelected(payload)
  }

  return (
    <>
      <WeekOverview
        desks={desks}
        registrations={registrations}
        locks={locks}
        weekDates={weekDates}
        branchId={branchId}
        onBookingClick={handleClick}
      />
      {/* A cancelled card is a free half hour still wearing a name — a guest
          gets the booking form for it, not a record of who used to sit there. */}
      {selected && cancelled && (
        <BookingDialog
          open
          onOpenChange={(v) => !v && closeAll()}
          deskId={selected.desk.id}
          deskLabel={selected.desk.label}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          onSuccess={() => {
            setMyIds(readMyRegistrationIds())
            closeAll()
            router.refresh()
          }}
        />
      )}
      {selected && !cancelled && !requestingChange && (
        <BookingDetailDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          audience="guest-own"
          registrationId={selected.registration.id}
          deskLabel={selected.desk.label}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          studentName={selected.registration.studentName}
          className={selected.registration.className}
          recurringRegistrationId={selected.registration.recurringRegistrationId}
          status={selected.registration.status}
          onSuccess={() => router.refresh()}
          onRequestCancel={() => setRequestingChange(true)}
        />
      )}
      {selected && !cancelled && requestingChange && (
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
    </>
  )
}
