"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronDownIcon, LayoutDashboardIcon, LogOutIcon, Loader2Icon, UserIcon } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Profile } from "@/types"

const ROLE_LABELS: Record<Profile["role"], string> = {
  admin: "Admin",
  quan_sinh: "Quản sinh",
}

// Only rendered when a profile exists (see AppHeader) — a guest session has
// no account to sign out of or dashboard to link to, so this component never
// needs to handle a null profile itself.
export function UserMenu({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const trimmed = profile.fullName.trim()
  const initial = trimmed.charAt(0).toUpperCase() || "?"
  // Vietnamese names are addressed by the given name, which is the last
  // word — showing the full name in the header trigger would make it too wide.
  const displayName = trimmed.split(/\s+/).pop() || trimmed

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await createBrowserClient().auth.signOut()
    } finally {
      setSigningOut(false)
    }
    router.push("/noi-bo/dang-nhap")
    // The internal shell is server-rendered from the session cookie, so the
    // client router cache has to be dropped or the stale authenticated layout
    // survives.
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 outline-none transition-colors hover:bg-accent">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initial}
        </span>
        <span className="max-w-24 truncate text-sm font-medium sm:max-w-none">{displayName}</span>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <UserIcon className="size-3.5 shrink-0" />
            <span className="truncate">{profile.fullName}</span>
          </span>
          <Badge variant="secondary" className="shrink-0">
            {ROLE_LABELS[profile.role]}
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/noi-bo/dashboard">
            <LayoutDashboardIcon />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={signingOut} onSelect={handleSignOut}>
          {signingOut ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <LogOutIcon />}
          Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
