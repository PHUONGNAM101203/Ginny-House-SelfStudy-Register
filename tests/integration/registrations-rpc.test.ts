import { describe, it, expect, beforeAll } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321"
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let deskId: string

beforeAll(async () => {
  const { data } = await supabase.from("desks").select("id").limit(1).single()
  deskId = data!.id
})

describe("create_registration", () => {
  it("creates a registration for a free slot", async () => {
    const { data, error } = await supabase.rpc("create_registration", {
      p_desk_id: deskId,
      p_date: "2026-08-24",
      p_start_time: "08:00",
      p_end_time: "08:30",
      p_full_name: "Nguyễn Văn A",
      p_phone: "0900000001",
      p_is_recurring: false,
      p_admin_created: false,
    })
    expect(error).toBeNull()
    expect(data.status).toBe("active")
  })

  it("rejects a double booking on the same desk/time", async () => {
    await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-25", p_start_time: "09:00", p_end_time: "09:30",
      p_full_name: "A", p_phone: "0900000002", p_is_recurring: false, p_admin_created: false,
    })
    const { error } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-25", p_start_time: "09:00", p_end_time: "09:30",
      p_full_name: "B", p_phone: "0900000003", p_is_recurring: false, p_admin_created: false,
    })
    expect(error).not.toBeNull()
  })
})

describe("cancel_registration", () => {
  it("cancels when name+phone match", async () => {
    const { data: reg } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-26", p_start_time: "10:00", p_end_time: "10:30",
      p_full_name: "Trần Thị B", p_phone: "0900000004", p_is_recurring: false, p_admin_created: false,
    })
    const { error } = await supabase.rpc("cancel_registration", {
      p_registration_id: reg.id, p_full_name: "Trần Thị B", p_phone: "0900000004",
    })
    expect(error).toBeNull()
  })

  it("rejects when phone does not match", async () => {
    const { data: reg } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-27", p_start_time: "11:00", p_end_time: "11:30",
      p_full_name: "Lê Văn C", p_phone: "0900000005", p_is_recurring: false, p_admin_created: false,
    })
    const { error } = await supabase.rpc("cancel_registration", {
      p_registration_id: reg.id, p_full_name: "Lê Văn C", p_phone: "0900000099",
    })
    expect(error).not.toBeNull()
  })

  it("rejects when name does not match", async () => {
    const { data: reg } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-30", p_start_time: "15:00", p_end_time: "15:30",
      p_full_name: "Đỗ Văn F", p_phone: "0900000009", p_is_recurring: false, p_admin_created: false,
    })
    const { error } = await supabase.rpc("cancel_registration", {
      p_registration_id: reg.id, p_full_name: "Wrong Name", p_phone: "0900000009",
    })
    expect(error).not.toBeNull()
  })

  it("cancels using the name from booking time, even after a later booking on the same phone changes the student's name", async () => {
    const phone = "0900000008"

    // R1 booked as "A".
    const { data: reg1 } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-28", p_start_time: "14:00", p_end_time: "14:30",
      p_full_name: "A", p_phone: phone, p_is_recurring: false, p_admin_created: false,
    })

    // Same phone rebooked as "B" — mutates students.full_name to "B" via the
    // create_registration upsert (on conflict (phone) do update set full_name = excluded.full_name).
    await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-29", p_start_time: "14:00", p_end_time: "14:30",
      p_full_name: "B", p_phone: phone, p_is_recurring: false, p_admin_created: false,
    })

    // Cancelling R1 with the name actually used to book it ("A") must still
    // succeed — cancel_registration must compare against the registration's
    // own student_name snapshot, not the now-mutated live students.full_name.
    const { error } = await supabase.rpc("cancel_registration", {
      p_registration_id: reg1.id, p_full_name: "A", p_phone: phone,
    })
    expect(error).toBeNull()
  })

  describe("admin bypass", () => {
    let adminClient: SupabaseClient
    const adminEmail = `admin-test-${Date.now()}@example.com`
    const adminPassword = "test-password-123!"

    beforeAll(async () => {
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
      const serviceClient = createClient(SUPABASE_URL, serviceRoleKey)

      const { data: userData, error: userError } = await serviceClient.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
      })
      if (userError || !userData.user) {
        throw userError ?? new Error("failed to create admin test user")
      }

      const { error: profileError } = await serviceClient.from("profiles").insert({
        id: userData.user.id,
        full_name: "Admin Test",
        role: "admin",
      })
      if (profileError) {
        throw profileError
      }

      adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      const { error: signInError } = await adminClient.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      })
      if (signInError) {
        throw signInError
      }
    })

    it("lets an admin cancel any registration regardless of name/phone match", async () => {
      const { data: reg } = await supabase.rpc("create_registration", {
        p_desk_id: deskId, p_date: "2026-09-01", p_start_time: "13:00", p_end_time: "13:30",
        p_full_name: "Guest E", p_phone: "0900000010", p_is_recurring: false, p_admin_created: false,
      })
      const { error } = await adminClient.rpc("cancel_registration", {
        p_registration_id: reg.id,
      })
      expect(error).toBeNull()
    })
  })
})

describe("materialize_recurring_registrations", () => {
  // A guest's lịch cố định is a request until an admin approves it
  // (migration 0029), so it must not quietly hold a desk for future weeks in
  // the meantime — that would make the approval meaningless.
  it("skips a recurring rule that is still waiting for approval", async () => {
    await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-31", p_start_time: "12:00", p_end_time: "12:30",
      p_full_name: "Phạm D", p_phone: "0900000006", p_is_recurring: true, p_admin_created: false,
    })
    const { data: count, error } = await supabase.rpc("materialize_recurring_registrations", {
      p_week_start: "2026-09-07",
    })
    expect(error).toBeNull()
    expect(count).toBe(0)
  })

  it("materialises the rule once it has been approved", async () => {
    const { data: reg } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-31", p_start_time: "15:00", p_end_time: "15:30",
      p_full_name: "Phạm E", p_phone: "0900000016", p_is_recurring: true, p_admin_created: false,
    })

    // Its own admin: the one in the "admin bypass" block is scoped to that
    // describe, and review_recurring_registration is is_admin()-gated.
    const email = `approver-${Date.now()}@example.com`
    const password = "test-password-123!"
    const service = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? "")
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    expect(createError).toBeNull()
    const { error: profileError } = await service
      .from("profiles")
      .insert({ id: created!.user!.id, full_name: "Approver Test", role: "admin" })
    expect(profileError).toBeNull()

    const admin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { error: signInError } = await admin.auth.signInWithPassword({ email, password })
    expect(signInError).toBeNull()

    const { error: reviewError } = await admin.rpc("review_recurring_registration", {
      p_id: reg.recurring_registration_id,
      p_approve: true,
    })
    expect(reviewError).toBeNull()

    const { data: count, error } = await supabase.rpc("materialize_recurring_registrations", {
      p_week_start: "2026-09-14",
    })
    expect(error).toBeNull()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
