"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { WeekOverview, type WeekBookingClick } from "@/components/schedule/WeekOverview"
import { BookingDetailDialog } from "@/components/booking/BookingDetailDialog"
import { RequestChangeDialog } from "@/components/booking/RequestChangeDialog"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"
import { readMyRegistrationIds } from "@/lib/my-registrations"

/**
 * Guest week view. Mirrors ScheduleGridClient's rules for the day view: a
 * booking this browser made opens in full with a huỷ that goes to the admin
 * as a phiếu; anyone else's opens read-only and says so.
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

  function closeAll() {
    setSelected(null)
    setRequestingChange(false)
  }

  return (
    <>
      <WeekOverview
        desks={desks}
        registrations={registrations}
        locks={locks}
        weekDates={weekDates}
        branchId={branchId}
        onBookingClick={setSelected}
      />
      {selected && !requestingChange && (
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
      {selected && requestingChange && (
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
