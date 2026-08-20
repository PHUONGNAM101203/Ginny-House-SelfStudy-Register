"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOutIcon, Loader2Icon } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

// Split out of AppHeader (a Server Component) for the same reason ThemeToggle is:
// signing out needs a click handler and the browser Supabase client.
export function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      await createBrowserClient().auth.signOut()
    } finally {
      setLoading(false)
    }
    router.push("/noi-bo/dang-nhap")
    // The internal shell is server-rendered from the session cookie, so the client
    // router cache has to be dropped or the stale authenticated layout survives.
    router.refresh()
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleSignOut}
      disabled={loading}
      aria-label="Đăng xuất"
      title="Đăng xuất"
    >
      {loading ? (
        <Loader2Icon className="h-4 w-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <LogOutIcon className="h-4 w-4" />
      )}
    </Button>
  )
}
