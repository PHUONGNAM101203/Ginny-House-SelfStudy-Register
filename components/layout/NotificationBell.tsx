"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BellIcon, BellRingIcon, BellOffIcon, XIcon } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { vi } from "date-fns/locale"
import { markNotificationsReadAction, deleteNotificationAction, deleteAllNotificationsAction } from "@/actions/notifications"
import { subscribeToPushAction, unsubscribeFromPushAction, sendTestPushAction } from "@/actions/push"
import { subscribeToNotifications } from "@/lib/notification-realtime"
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

// Read state is per-item now: clicking one notification marks only that one
// read and drops the badge by exactly one, rather than the dropdown opening
// silently clearing everything at once.
export function NotificationBell({ initialUnreadCount, items: initialItems }: { initialUnreadCount: number; items: NotificationItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  // Derived, not a second piece of state: a separate counter drifted away
  // from the list — the badge kept showing 1 after the last notification had
  // been deleted. The server computes it the same way (see
  // lib/notifications/summary.ts), so there is nothing to keep in sync.
  const unreadCount = items.filter((i) => !i.read).length
  const [, startTransition] = useTransition()
  const [pushState, setPushState] = useState<PushSupport>("checking")

  // Props change on every router.refresh() the realtime subscription below
  // triggers — local state has to re-sync from them each time, or a
  // useState(initialX) would only ever reflect the very first server render
  // (the "read prop once at mount" footgun this codebase has hit before).
  useEffect(() => {
    setItems(initialItems)
  }, [initialItems])

  useEffect(() => {
    return subscribeToNotifications(() => router.refresh())
  }, [router])

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

  function markOneRead(item: NotificationItem) {
    if (item.read) return
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)))
    startTransition(() => {
      markNotificationsReadAction([item.id])
    })
  }

  async function deleteItem(item: NotificationItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    const result = await deleteNotificationAction(item.id)
    if (!result.ok) toast.error(result.error)
  }

  const [clearing, setClearing] = useState(false)
  const [testing, setTesting] = useState(false)

  /**
   * "Gửi thử" — the only reliable way to tell an expired subscription from a
   * muted OS from a site iOS won't push to. Sends to this device and shows
   * whatever the push service replied.
   */
  async function sendTestPush() {
    setTesting(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        toast.error("Thiết bị này chưa bật thông báo đẩy")
        return
      }
      const result = await sendTestPushAction(subscription.endpoint)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success("Đã gửi. Nếu không thấy thông báo hiện lên, hệ điều hành đang chặn.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không gửi thử được")
    } finally {
      setTesting(false)
    }
  }

  async function clearAll() {
    const ids = items.map((i) => i.id)
    if (ids.length === 0) return
    // Optimistic, same as deleteItem: the list empties immediately and the
    // failure path puts it back rather than leaving a lie on screen.
    const previous = items
    setItems([])
    setClearing(true)
    const result = await deleteAllNotificationsAction(ids)
    setClearing(false)
    if (!result.ok) {
      setItems(previous)
      toast.error(result.error)
      return
    }
    toast.success(`Đã xoá ${result.data.count} thông báo`)
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
    <DropdownMenu>
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
        <div className="flex items-center justify-between gap-2 pr-1">
          <DropdownMenuLabel>Thông báo</DropdownMenuLabel>
          {items.length > 0 && (
            <button
              type="button"
              // Inside a dropdown, a plain button still closes the menu on
              // click — stopPropagation keeps the list open so the emptied
              // state is visible instead of the panel vanishing.
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void clearAll()
              }}
              disabled={clearing}
              className="shrink-0 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              {clearing ? "Đang xoá..." : "Xoá tất cả"}
            </button>
          )}
        </div>
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
                <DropdownMenuItem
                  key={item.id}
                  asChild={!!item.link}
                  className="items-start gap-1 pr-1"
                  onSelect={(e) => {
                    if (item.link) return // Link's own navigation already fires; onClick below still marks it read.
                    e.preventDefault()
                    markOneRead(item)
                  }}
                >
                  {item.link ? (
                    <Link href={item.link} onClick={() => markOneRead(item)} className="flex items-start justify-between gap-1">
                      {content}
                      <button
                        type="button"
                        aria-label="Xoá thông báo"
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          deleteItem(item)
                        }}
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </Link>
                  ) : (
                    <div className="flex w-full items-start justify-between gap-1">
                      {content}
                      <button
                        type="button"
                        aria-label="Xoá thông báo"
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          deleteItem(item)
                        }}
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </div>
                  )}
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
            {pushState === "subscribed" && (
              <DropdownMenuItem
                disabled={testing}
                onSelect={(e) => {
                  e.preventDefault()
                  void sendTestPush()
                }}
                className="gap-2 text-muted-foreground"
              >
                <BellRingIcon className="size-4" />
                {testing ? "Đang gửi thử..." : "Gửi thử một thông báo tới thiết bị này"}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
