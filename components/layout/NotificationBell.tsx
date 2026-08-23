"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { BellIcon, BellRingIcon, BellOffIcon } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { markNotificationsReadAction } from "@/actions/notifications"
import { subscribeToPushAction, unsubscribeFromPushAction } from "@/actions/push"
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

// Web Push's applicationServerKey wants a raw Uint8Array, but the VAPID
// public key is handed out as URL-safe base64 — same conversion every
// web-push guide reproduces verbatim, no library needed for one function.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length))
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

type PushSupport = "checking" | "unsupported" | "subscribed" | "unsubscribed"

// Read state is marked the moment the dropdown opens (all currently-unread
// items at once) rather than per-item on click — the badge exists to say
// "something happened since you last looked", not to track which specific
// item you engaged with.
export function NotificationBell({ initialUnreadCount, items }: { initialUnreadCount: number; items: NotificationItem[] }) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [, startTransition] = useTransition()
  const [pushState, setPushState] = useState<PushSupport>("checking")

  useEffect(() => {
    async function checkPushStatus() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setPushState("unsupported")
        return
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js")
        const subscription = await registration.pushManager.getSubscription()
        setPushState(subscription ? "subscribed" : "unsubscribed")
      } catch {
        setPushState("unsupported")
      }
    }
    checkPushStatus()
  }, [])

  function handleOpenChange(open: boolean) {
    if (!open || unreadCount === 0) return
    const unreadIds = items.filter((i) => !i.read).map((i) => i.id)
    setUnreadCount(0)
    startTransition(() => {
      markNotificationsReadAction(unreadIds)
    })
  }

  async function subscribeToPush() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!publicKey) return toast.error("Chưa cấu hình thông báo đẩy")

    const permission = await Notification.requestPermission()
    if (permission !== "granted") {
      toast.error("Bạn đã từ chối quyền thông báo — hãy bật lại trong cài đặt trình duyệt")
      return
    }

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    const json = subscription.toJSON()
    const result = await subscribeToPushAction({ endpoint: json.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setPushState("subscribed")
    toast.success("Đã bật thông báo đẩy trên thiết bị này")
  }

  async function unsubscribeFromPush() {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await unsubscribeFromPushAction({ endpoint: subscription.endpoint })
      await subscription.unsubscribe()
    }
    setPushState("unsubscribed")
    toast.success("Đã tắt thông báo đẩy trên thiết bị này")
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
        {(pushState === "subscribed" || pushState === "unsubscribed") && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                pushState === "subscribed" ? unsubscribeFromPush() : subscribeToPush()
              }}
              className="gap-2 text-muted-foreground"
            >
              {pushState === "subscribed" ? <BellRingIcon className="size-4" /> : <BellOffIcon className="size-4" />}
              {pushState === "subscribed" ? "Đã bật thông báo đẩy trên thiết bị này" : "Bật thông báo đẩy trên thiết bị này"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
