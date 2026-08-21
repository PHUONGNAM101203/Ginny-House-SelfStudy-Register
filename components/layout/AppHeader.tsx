"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDaysIcon } from "lucide-react"
import BrandMark from "@/components/brand/BrandMark"
import { VietnamClock } from "@/components/layout/VietnamClock"
import { AppLauncher } from "@/components/layout/AppLauncher"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { UserMenu } from "@/components/layout/UserMenu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Profile } from "@/types"

/**
 * Shared top bar for every page — guest schedule and the /noi-bo/* internal
 * shell alike — so branding and controls stay in one place instead of each
 * page hand-rolling its own row. `profile` is the only thing that varies:
 * null for a guest session (no calendar/launcher icons, no avatar menu — a
 * guest has no account to switch pages from or sign out of), a real Profile
 * once signed in.
 */
export function AppHeader({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const onCalendar = pathname === "/noi-bo/lich" || pathname === "/"

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-6">
      <Link href={profile ? "/noi-bo/lich" : "/"} className="flex min-w-0 items-center gap-2 text-primary">
        <BrandMark className="size-6 shrink-0" priority />
        <span className="truncate text-lg leading-none font-semibold tracking-tight">Ginny House</span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        <VietnamClock className="hidden sm:flex" />

        {profile && (
          <div className="flex items-center gap-0.5 rounded-full border p-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Lịch"
              aria-current={onCalendar ? "page" : undefined}
              className={cn("rounded-full", onCalendar && "bg-accent text-foreground")}
              asChild
            >
              <Link href="/noi-bo/lich">
                <CalendarDaysIcon className="size-5" />
              </Link>
            </Button>
            {profile.role === "admin" && <AppLauncher />}
          </div>
        )}

        <ThemeToggle />

        {profile && <UserMenu profile={profile} />}
      </div>
    </header>
  )
}
