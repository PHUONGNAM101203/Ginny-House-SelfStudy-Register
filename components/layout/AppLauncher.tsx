"use client"

import Link from "next/link"
import { Grid3x3Icon, Building2Icon, LockIcon, GraduationCapIcon, UsersIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"

// Admin-only tools that don't fit as a single top-level icon. More entries
// land here as the app grows past the schedule/dashboard core (hence the
// grid-icon "launcher" framing rather than flattening them into the header).
const APPS = [
  { href: "/noi-bo/quan-ly/co-so", label: "Quản lý cơ sở", icon: Building2Icon },
  { href: "/noi-bo/quan-ly/khoa-lich", label: "Khoá lịch", icon: LockIcon },
  { href: "/noi-bo/quan-ly/hoc-sinh", label: "Học sinh", icon: GraduationCapIcon },
  { href: "/noi-bo/quan-ly/nhan-su", label: "Nhân sự", icon: UsersIcon },
] as const

export function AppLauncher() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label="Mở ứng dụng khác">
          <Grid3x3Icon className="size-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2 sm:w-64">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {APPS.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="flex flex-row items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent sm:flex-col sm:gap-1.5 sm:py-3 sm:text-center sm:text-xs"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <app.icon className="size-4.5" />
              </span>
              {app.label}
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
