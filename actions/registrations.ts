"use server"

import { revalidatePath, refresh } from "next/cache"
import { after } from "next/server"
import { createPublicClient } from "@/lib/supabase/public"
import { sendPushToRole } from "@/lib/push/send"
import { broadcastNotificationsUpdate } from "@/lib/notification-realtime"
import {
  createRegistrationSchema,
  cancelRegistrationSchema,
  adminCancelRegistrationSchema,
  requestChangeSchema,
  reviewChangeRequestSchema,
} from "@/lib/validations/registration"
import type { ActionResult } from "@/types"
import { requireAdmin } from "@/lib/auth"
import { createServerClient } from "@/lib/supabase/server"

export type StudentLookupResult = { fullName: string; phone: string; className: string | null }

/**
 * Autocomplete for a returning guest: once they've typed enough of their own
 * phone number, offer to prefill name/class from their most recent
 * registration (see find_student_by_phone_prefix, migration 0008). Phone-
 * keyed rather than name-keyed on purpose — see that RPC's comment.
 */
export async function findStudentByPhonePrefixAction(phonePrefix: string): Promise<ActionResult<StudentLookupResult | null>> {
  if (phonePrefix.length < 4) return { ok: true, data: null }

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("find_student_by_phone_prefix", { p_phone_prefix: phonePrefix })
  if (error) return { ok: false, error: error.message }

  const row = data?.[0]
  if (!row) return { ok: true, data: null }
  return { ok: true, data: { fullName: row.full_name, phone: row.phone, className: row.class_name } }
}

export async function createRegistrationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("create_registration", {
    p_desk_id: parsed.data.deskId,
    p_date: parsed.data.date,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_class_name: parsed.data.className,
    p_is_recurring: parsed.data.isRecurring,
    p_admin_created: false,
    p_zalo_contact: parsed.data.zaloContact || null,
  })

  if (error) {
    if (error.code === "23P01" || error.code === "40P01") {
      // 23P01: the GiST exclusion constraint cleanly rejects the losing insert.
      // 40P01: under real concurrency, two overlapping inserts can instead
      // deadlock each other while the exclusion check holds index-level
      // locks; Postgres kills one as the deadlock victim. Same user-facing
      // meaning either way — someone else just took this slot.
      return { ok: false, error: "Khung giờ này vừa có người đặt, vui lòng chọn khung khác" }
    }
    if (error.message.includes("Slot is locked")) {
      return { ok: false, error: "Khung giờ này đã bị khoá, không có phòng" }
    }
    return { ok: false, error: "Có lỗi xảy ra, vui lòng thử lại" }
  }

  revalidatePath("/")
  // The bell got its row from create_registration (migration 0017) and the
  // realtime broadcast lit it up, but nothing ever pushed — so a phone with
  // notifications switched on stayed silent for the most important event in
  // the app. target_role null matches the notification row: every internal
  // role, quản sinh included.
  after(async () => {
    await sendPushToRole(null, {
      title: "Đăng ký lịch mới",
      body:
        parsed.data.fullName +
        (parsed.data.className ? ` · ${parsed.data.className}` : "") +
        ` — ${parsed.data.date} ${parsed.data.startTime}-${parsed.data.endTime}`,
      link: "/noi-bo/lich",
    })
    await broadcastNotificationsUpdate()
  })
  return { ok: true, data: { id: data.id } }
}

export async function cancelRegistrationAction(input: unknown): Promise<ActionResult<null>> {
  const parsed = cancelRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = createPublicClient()
  const { error } = await supabase.rpc("cancel_registration", {
    p_registration_id: parsed.data.registrationId,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
  })

  if (error) {
    return { ok: false, error: "Tên hoặc số điện thoại không khớp" }
  }

  revalidatePath("/")
  // Matches the registration_cancelled row cancel_registration inserts
  // (migration 0020) — Gin Anh's point was that a cancellation should reach
  // people without anyone having to relay it by hand.
  after(async () => {
    await sendPushToRole(null, {
      title: "Guest huỷ lịch",
      body: parsed.data.fullName,
      link: "/noi-bo/lich",
    })
    await broadcastNotificationsUpdate()
  })
  return { ok: true, data: null }
}

export async function createRegistrationAsAdminAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  const parsed = createRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc("create_registration", {
    p_desk_id: parsed.data.deskId,
    p_date: parsed.data.date,
    p_start_time: parsed.data.startTime,
    p_end_time: parsed.data.endTime,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_class_name: parsed.data.className,
    p_is_recurring: parsed.data.isRecurring,
    p_admin_created: true,
    p_zalo_contact: parsed.data.zaloContact || null,
  })

  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Khung giờ này đã có người đặt" }
    return { ok: false, error: error.message }
  }

  revalidatePath("/noi-bo/lich")
  revalidatePath("/")
  return { ok: true, data: { id: data.id } }
}

/**
 * Permanently stop a recurring registration ("Huỷ luôn lịch cố định này").
 *
 * Distinct from cancelRegistrationAction, which only cancels one week's
 * materialized instance — this deactivates the rule itself so it stops
 * re-materializing and the desk/time is released for future weeks. Already
 * materialized rows for past/current weeks are intentionally left alone; use
 * the per-week cancel for those.
 *
 * Admin-only, enforced both here (requireAdmin) and in the database
 * (recurring_registrations_admin_update, migration 0004).
 */
export async function deactivateRecurringRegistrationAction(id: string): Promise<ActionResult<null>> {
  await requireAdmin()
  const supabase = await createServerClient()
  const { error } = await supabase.from("recurring_registrations").update({ active: false }).eq("id", id)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/hoc-sinh")
  revalidatePath("/noi-bo/dashboard")
  revalidatePath("/noi-bo/lich")
  revalidatePath("/")
  // onClick-invoked from RecurringRegistrationTable — revalidatePath alone
  // won't push a refresh to the page that called it (see
  // actions/students.ts's createStudentAction for the full explanation).
  refresh()
  return { ok: true, data: null }
}

/**
 * Admin's direct cancel from the internal calendar — no name/phone match.
 *
 * Calls the same cancel_registration RPC as the guest path, but through the
 * authenticated server client (not the anon one createRegistrationAction
 * uses), so auth.uid() resolves inside the RPC and its `is_admin()` branch
 * (see migration 0002) short-circuits before the name/phone check ever runs.
 */
export async function cancelRegistrationAsAdminAction(input: unknown): Promise<ActionResult<null>> {
  await requireAdmin()
  const parsed = adminCancelRegistrationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("cancel_registration", {
    p_registration_id: parsed.data.registrationId,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/lich")
  revalidatePath("/")
  // onClick-invoked (AdminCancelDialog's button, not a <form action>) —
  // revalidatePath alone doesn't push a refresh to the caller in this
  // Next.js version, so the cancelled booking stayed visible on the
  // calendar until a manual reload.
  refresh()
  return { ok: true, data: null }
}

/**
 * A guest's "phiếu xin xoá + đổi lịch" — lower-friction than the direct
 * self-cancel path (no exact name/phone match against the original booking),
 * queued for admin review instead of taking effect immediately.
 */
export async function requestRegistrationChangeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = requestChangeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = createPublicClient()
  const { data, error } = await supabase.rpc("request_registration_change", {
    p_registration_id: parsed.data.registrationId,
    p_kind: parsed.data.kind,
    p_requested_by_name: parsed.data.requestedByName,
    p_requested_by_phone: parsed.data.requestedByPhone,
    p_reason: parsed.data.reason,
    p_new_desk_id: parsed.data.newDeskId ?? null,
    p_new_date: parsed.data.newDate ?? null,
    p_new_start_time: parsed.data.newStartTime ?? null,
    p_new_end_time: parsed.data.newEndTime ?? null,
  })

  if (error) {
    // registration_change_requests_one_pending_idx (migration 0005): a
    // second request for the same booking while one is still pending.
    if (error.code === "23505") {
      return { ok: false, error: "Bạn đã gửi yêu cầu cho lịch này rồi, vui lòng chờ admin duyệt" }
    }
    return { ok: false, error: "Có lỗi xảy ra, vui lòng thử lại" }
  }

  // Fire-and-forget, matches the notifications row request_registration_change
  // (migration 0006) already inserts for the in-app bell — push is a second,
  // independent delivery channel for the same event, not authoritative.
  after(async () => {
    await sendPushToRole("admin", {
      title: parsed.data.kind === "cancel" ? "Yêu cầu huỷ lịch mới" : "Yêu cầu đổi lịch mới",
      body: parsed.data.requestedByName,
      link: "/noi-bo/quan-ly/yeu-cau-doi-lich",
    })
    await broadcastNotificationsUpdate()
  })

  return { ok: true, data: { id: data.id } }
}

/** Admin approves or rejects a pending change request (see review_registration_change, migration 0005). */
export async function reviewRegistrationChangeAction(input: unknown): Promise<ActionResult<null>> {
  await requireAdmin()
  const parsed = reviewChangeRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.rpc("review_registration_change", {
    p_request_id: parsed.data.requestId,
    p_approve: parsed.data.approve,
    p_admin_note: parsed.data.adminNote ?? null,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath("/noi-bo/quan-ly/yeu-cau-doi-lich")
  revalidatePath("/noi-bo/lich")
  revalidatePath("/")
  refresh()
  after(() => broadcastNotificationsUpdate())
  return { ok: true, data: null }
}
