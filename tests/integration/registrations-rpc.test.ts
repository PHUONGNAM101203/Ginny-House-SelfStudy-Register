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
  // Since migration 0031 a guest cannot cancel at all — every huỷ goes
  // through admin review. The name/phone tests these replace asserted the
  // old self-cancel, which no longer exists in any form.
  it("refuses a guest cancellation with GH001, even with the right name and phone", async () => {
    const { data: reg } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-26", p_start_time: "10:00", p_end_time: "10:30",
      p_full_name: "Trần Thị B", p_phone: "0900000004", p_is_recurring: false, p_admin_created: false,
    })
    const { error } = await supabase.rpc("cancel_registration", {
      p_registration_id: reg.id, p_full_name: "Trần Thị B", p_phone: "0900000004",
    })
    expect(error).not.toBeNull()
    // The UI keys on this code to steer the guest into the phiếu flow, so it
    // is part of the contract rather than an arbitrary failure.
    expect(error?.code).toBe("GH001")
  })

  it("leaves the booking active when a guest tries to cancel it", async () => {
    const { data: reg } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-27", p_start_time: "11:00", p_end_time: "11:30",
      p_full_name: "Lê Văn C", p_phone: "0900000005", p_is_recurring: false, p_admin_created: false,
    })
    await supabase.rpc("cancel_registration", {
      p_registration_id: reg.id, p_full_name: "Lê Văn C", p_phone: "0900000005",
    })
    const { data: after } = await supabase
      .from("registrations")
      .select("status")
      .eq("id", reg.id)
      .single()
    expect(after?.status).toBe("active")
  })

  it("refuses a guest cancellation on a wrong name or phone too", async () => {
    const { data: reg } = await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-30", p_start_time: "15:00", p_end_time: "15:30",
      p_full_name: "Đỗ Văn F", p_phone: "0900000009", p_is_recurring: false, p_admin_created: false,
    })
    const { error } = await supabase.rpc("cancel_registration", {
      p_registration_id: reg.id, p_full_name: "Wrong Name", p_phone: "0900000009",
    })
    expect(error).not.toBeNull()
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
  it("creates one registration per active recurring rule for the given week", async () => {
    // Recurring schedules apply immediately again — migration 0033 removed
    // the approval step that briefly gated this.
    await supabase.rpc("create_registration", {
      p_desk_id: deskId, p_date: "2026-08-31", p_start_time: "12:00", p_end_time: "12:30",
      p_full_name: "Phạm D", p_phone: "0900000006", p_is_recurring: true, p_admin_created: false,
    })
    const { data: count, error } = await supabase.rpc("materialize_recurring_registrations", {
      p_week_start: "2026-09-07",
    })
    expect(error).toBeNull()
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
