"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { BellIcon } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { markNotificationsReadAction } from "@/actions/notifications"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { NotificationItem } from "@/lib/notifications/summary"

// Read state is marked the moment the dropdown opens (all currently-unread
// items at once) rather than per-item on click — the badge exists to say
// "something happened since you last looked", not to track which specific
// item you engaged with.
export function NotificationBell({ initialUnreadCount, items }: { initialUnreadCount: number; items: NotificationItem[] }) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [, startTransition] = useTransition()

  function handleOpenChange(open: boolean) {
    if (!open || unreadCount === 0) return
    const unreadIds = items.filter((i) => !i.read).map((i) => i.id)
    setUnreadCount(0)
    startTransition(() => {
      markNotificationsReadAction(unreadIds)
    })
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative rounded-full" aria-label="Thông báo">
          <BellIcon className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Thông báo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">Chưa có thông báo nào.</p>
        ) : (
          <div className="flex max-h-96 flex-col overflow-y-auto">
            {items.map((item) => {
              const content = (
                <div className={cn("flex flex-col gap-0.5 py-1", !item.read && "font-medium")}>
                  <span className="text-sm">{item.title}</span>
                  {item.body && <span className="text-xs text-muted-foreground">{item.body}</span>}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: vi })}
                  </span>
                </div>
              )
              return (
                <DropdownMenuItem key={item.id} asChild={!!item.link} className="items-start">
                  {item.link ? <Link href={item.link}>{content}</Link> : content}
                </DropdownMenuItem>
              )
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
