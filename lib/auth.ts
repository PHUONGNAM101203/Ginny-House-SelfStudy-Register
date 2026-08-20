import { redirect } from "next/navigation"
import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type { Profile } from "@/types"

// Deliberately split from getSessionProfile so callers can tell "no session at all"
// apart from "session exists but has no profiles row" — the two need different
// redirect targets (see requireProfile). `cache()` keeps it to one auth round-trip
// per request even when both helpers are consulted.
const getSessionUserId = cache(async (): Promise<string | null> => {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
})

export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const userId = await getSessionUserId()
  if (!userId) return null

  const supabase = await createServerClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", userId)
    .single()

  if (!profile) return null
  return { id: profile.id, fullName: profile.full_name, role: profile.role }
})

export async function requireProfile(): Promise<Profile> {
  // No session at all: the login page is the right destination.
  if (!(await getSessionUserId())) redirect("/noi-bo/dang-nhap")

  const profile = await getSessionProfile()
  // Session exists but carries no `profiles` row (an orphaned auth user). Sending
  // that user to /noi-bo/dang-nhap would loop forever, because proxy.ts bounces any
  // authenticated session off the login page straight back to /noi-bo/lich. "/" has
  // no auth-based redirect logic at all, so it terminates the loop. The stale session
  // cookie is left in place — signing out needs cookie mutation, which isn't available
  // from every context this runs in.
  if (!profile) redirect("/")
  return profile
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile()
  if (profile.role !== "admin") redirect("/noi-bo/lich")
  return profile
}
