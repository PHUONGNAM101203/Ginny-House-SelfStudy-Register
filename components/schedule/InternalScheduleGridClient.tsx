"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ScheduleGrid, type SlotClickPayload } from "@/components/schedule/ScheduleGrid"
import { BookingDialog } from "@/components/booking/BookingDialog"
import { BookingDetailDialog } from "@/components/booking/BookingDetailDialog"
import { createRegistrationAsAdminAction } from "@/actions/registrations"
import type { Desk, RegistrationRow, SlotLock } from "@/lib/schedule-data"

export function InternalScheduleGridClient({
  desks, date, registrations, locks, canBook, canCancel, branchName, phoneByStudentId,
}: {
  desks: Desk[]
  date: string
  registrations: RegistrationRow[]
  locks: SlotLock[]
  /** Quản sinh đặt hộ học sinh — staff-wide. */
  canBook: boolean
  /** Cancelling stays admin-only; a huỷ has to be an admin decision. */
  canCancel: boolean
  branchName?: string | null
  phoneByStudentId?: Map<string, string>
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<SlotClickPayload | null>(null)

  return (
    <>
      <ScheduleGrid
        desks={desks} date={date} registrations={registrations} locks={locks}
        onSlotClick={canBook ? setSelected : () => {}}
        phoneByStudentId={phoneByStudentId}
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
      {/* Previously nothing rendered here at all — clicking an existing
          booking as admin was a dead click (see actions/registrations.ts's
          cancelRegistrationAsAdminAction for why the RPC already supported
          this and only the UI was missing). */}
      {/* Both quản sinh and admin get the details; only the huỷ button is
          gated, so a quản sinh can look up a phone without being able to
          cancel — until Gin Anh asked for staff cancels, which canCancel now
          carries. */}
      {selected?.registration && (
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
