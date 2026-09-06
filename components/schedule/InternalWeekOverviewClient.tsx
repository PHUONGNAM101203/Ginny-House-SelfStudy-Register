"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { WeekOverview, type WeekBookingClick } from "@/components/schedule/WeekOverview"
import { BookingDetailDialog } from "@/components/booking/BookingDetailDialog"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

/**
 * Staff week view. Same detail dialog the day view opens
 * (InternalScheduleGridClient) — clicking a card in the week was previously a
 * dead click that only navigated to the day, so quản sinh had to switch views
 * to read a SĐT.
 *
 * No BookingDialog here on purpose: a week cell is one time slot across ten
 * desks, so there is no single free desk to book into. Booking stays in the
 * day view, which the rest of the cell still links to.
 */
export function InternalWeekOverviewClient({
  desks,
  registrations,
  locks,
  weekDates,
  branchId,
  branchName,
  phoneByStudentId,
  canCancel,
}: {
  desks: Desk[]
  registrations: RegistrationRow[]
  locks: SlotLock[]
  weekDates: string[]
  branchId?: string
  branchName?: string | null
  phoneByStudentId?: Map<string, string>
  canCancel: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<WeekBookingClick | null>(null)

  return (
    <>
      <WeekOverview
        desks={desks}
        registrations={registrations}
        locks={locks}
        weekDates={weekDates}
        branchId={branchId}
        phoneByStudentId={phoneByStudentId}
        onBookingClick={setSelected}
      />
      {selected && (
        <BookingDetailDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          audience="staff"
          registrationId={selected.registration.id}
          deskLabel={selected.desk.label}
          branchName={branchName}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          studentName={selected.registration.studentName}
          className={selected.registration.className}
          phone={selected.registration.studentId ? phoneByStudentId?.get(selected.registration.studentId) : null}
          recurringRegistrationId={selected.registration.recurringRegistrationId}
          canCancel={canCancel}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  )
}
