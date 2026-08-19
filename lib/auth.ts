import { redirect } from "next/navigation"
import { cache } from "react"
import { createServerClient } from "@/lib/supabase/server"
import type { Profile } from "@/types"

export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single()

  if (!profile) return null
  return { id: profile.id, fullName: profile.full_name, role: profile.role }
})

export async function requireProfile(): Promise<Profile> {
  const profile = await getSessionProfile()
  if (!profile) redirect("/noi-bo/dang-nhap")
  return profile
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile()
  if (profile.role !== "admin") redirect("/noi-bo/lich")
  return profile
}
