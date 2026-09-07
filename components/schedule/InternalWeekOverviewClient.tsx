"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { WeekOverview, type WeekBookingClick } from "@/components/schedule/WeekOverview"
import { BookingDetailDialog } from "@/components/booking/BookingDetailDialog"
import { BookingDialog } from "@/components/booking/BookingDialog"
import { createRegistrationAsAdminAction } from "@/actions/registrations"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

/**
 * Staff week view. Same detail dialog the day view opens
 * (InternalScheduleGridClient) — clicking a card in the week was previously a
 * dead click that only navigated to the day, so quản sinh had to switch views
 * to read a SĐT.
 *
 * A cancelled card behaves exactly as it does in the day view: the details,
 * plus "Tạo chỗ mới" into the booking form for the half hour it freed up.
 *
 * Booking an *empty* cell still belongs to the day view — a week cell is one
 * time slot across every desk, so there is no single free desk to book into.
 * The rest of the cell still links there.
 */
export function InternalWeekOverviewClient({
  desks,
  registrations,
  locks,
  weekDates,
  branchId,
  branchName,
  phoneByStudentId,
  canBook,
  canCancel,
}: {
  desks: Desk[]
  registrations: RegistrationRow[]
  locks: SlotLock[]
  weekDates: string[]
  branchId?: string
  branchName?: string | null
  phoneByStudentId?: Map<string, string>
  /** Quản sinh đặt hộ học sinh — same flag the day view uses. */
  canBook: boolean
  canCancel: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<WeekBookingClick | null>(null)
  const [bookingOver, setBookingOver] = useState(false)

  const cancelled = selected?.registration.status === "cancelled"

  function close() {
    setSelected(null)
    setBookingOver(false)
  }

  return (
    <>
      <WeekOverview
        desks={desks}
        registrations={registrations}
        locks={locks}
        weekDates={weekDates}
        branchId={branchId}
        phoneByStudentId={phoneByStudentId}
        onBookingClick={(payload) => {
          setBookingOver(false)
          setSelected(payload)
        }}
      />
      {selected && !bookingOver && (
        <BookingDetailDialog
          open
          onOpenChange={(v) => !v && close()}
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
          status={selected.registration.status}
          canCancel={canCancel}
          onSuccess={() => router.refresh()}
          onCreateNew={canBook ? () => setBookingOver(true) : undefined}
        />
      )}
      {selected && cancelled && bookingOver && (
        <BookingDialog
          open
          onOpenChange={(v) => !v && close()}
          deskId={selected.desk.id}
          deskLabel={selected.desk.label}
          date={selected.date}
          startTime={selected.startTime}
          endTime={selected.endTime}
          action={createRegistrationAsAdminAction}
          onSuccess={() => {
            close()
            router.refresh()
          }}
        />
      )}
    </>
  )
}
