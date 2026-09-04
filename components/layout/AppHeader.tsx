"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDaysIcon } from "lucide-react"
import BrandMark from "@/components/brand/BrandMark"
import { VietnamClock } from "@/components/layout/VietnamClock"
import { AppLauncher } from "@/components/layout/AppLauncher"
import { NotificationBell } from "@/components/layout/NotificationBell"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { UserMenu } from "@/components/layout/UserMenu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { NotificationItem } from "@/lib/notifications/summary"
import type { Profile } from "@/types"

/**
 * Shared top bar for every page — guest schedule and the /noi-bo/* internal
 * shell alike — so branding and controls stay in one place instead of each
 * page hand-rolling its own row. `profile` is the only thing that varies:
 * null for a guest session (no calendar/launcher icons, no avatar menu — a
 * guest has no account to switch pages from or sign out of), a real Profile
 * once signed in.
 */
export function AppHeader({
  profile,
  notifications,
}: {
  profile: Profile | null
  notifications?: { unreadCount: number; items: NotificationItem[] }
}) {
  const pathname = usePathname()
  const onCalendar = pathname === "/noi-bo/lich" || pathname === "/"

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-1.5 border-b bg-background/80 px-2.5 py-3 backdrop-blur supports-backdrop-filter:bg-background/70 sm:gap-3 sm:px-6">
      {/* Both sides were shrink-0, so at 320px the header simply overflowed
          and dragged the whole page into a horizontal scroll. The wordmark
          gives way first (the mark itself never does), and the controls keep
          their size — those are touch targets. */}
      <Link href={profile ? "/noi-bo/lich" : "/"} className="flex min-w-0 items-center gap-1.5 py-1.5 text-primary sm:gap-2">
        <BrandMark className="size-6 shrink-0" priority />
        <span className="truncate text-base leading-none font-semibold tracking-tight sm:text-lg">Ginny House</span>
      </Link>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-3">
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

        {profile && notifications && (
          <NotificationBell initialUnreadCount={notifications.unreadCount} items={notifications.items} />
        )}

        {profile && <UserMenu profile={profile} />}
      </div>
    </header>
  )
}
