import Link from "next/link"
import type { Profile } from "@/types"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { SignOutButton } from "@/components/layout/SignOutButton"
import { VietnamClock } from "@/components/layout/VietnamClock"

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      {/* flex-wrap + gap: the nav links and the account cluster both grow, and
          on a phone they have to stack instead of overlapping. */}
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/noi-bo/lich" className="font-semibold">Ginny House – Tự học</Link>
          <Link href="/noi-bo/lich" className="text-sm text-muted-foreground">Lịch</Link>
          <Link href="/noi-bo/dashboard" className="text-sm text-muted-foreground">Dashboard</Link>
          {profile.role === "admin" && (
            <>
              <Link href="/noi-bo/quan-ly/co-so" className="text-sm text-muted-foreground">Quản lý</Link>
              <Link href="/noi-bo/quan-ly/khoa-lich" className="text-sm text-muted-foreground">Khoá lịch</Link>
              <Link href="/noi-bo/quan-ly/hoc-sinh" className="text-sm text-muted-foreground">Học sinh</Link>
              <Link href="/noi-bo/quan-ly/nhan-su" className="text-sm text-muted-foreground">Nhân sự</Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <VietnamClock />
          {/* Truncated rather than hidden on phones: who is signed in still
              matters, it just cannot be allowed to push the row wider. */}
          <span className="max-w-24 truncate text-sm sm:max-w-none">{profile.fullName}</span>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
