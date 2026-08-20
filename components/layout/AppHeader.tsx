import Link from "next/link"
import type { Profile } from "@/types"
import { ThemeToggle } from "@/components/layout/ThemeToggle"

export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
        <div className="flex items-center gap-4">
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
          <span className="text-sm">{profile.fullName}</span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
