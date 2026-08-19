import { createServerClient as createSupabaseServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createServerClient() {
  const cookieStore = await cookies()
  return createSupabaseServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component render (not a Server Action/Route
            // Handler) where `cookies().set()` throws. Safe to ignore — proxy.ts
            // refreshes the session cookie on every request, so a stale cookie
            // here just means the *next* request re-syncs it.
          }
        },
      },
    }
  )
}
