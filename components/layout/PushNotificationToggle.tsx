"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BellRingIcon, BellOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { subscribeToPushAction, unsubscribeFromPushAction } from "@/actions/push"

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

type Support = "checking" | "unsupported" | "subscribed" | "unsubscribed"

/**
 * Staff-only bell toggle next to NotificationBell — turns on OS-level push
 * for this browser/device (desktop or phone) so a staff member sees a new
 * change request / chat message / missing-registration notice even with the
 * tab closed. iOS Safari only grants Notification permission to an
 * installed PWA (see app/manifest.ts), so this silently reports
 * "unsupported" there until the user has added the app to their home screen
 * — there's no way to detect that distinction from script, so the button
 * itself carries a title tip rather than a separate message.
 */
export function PushNotificationToggle() {
  const [state, setState] = useState<Support>("checking")

  useEffect(() => {
    async function checkStatus() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported")
        return
      }
      try {
        const registration = await navigator.serviceWorker.register("/sw.js")
        const subscription = await registration.pushManager.getSubscription()
        setState(subscription ? "subscribed" : "unsubscribed")
      } catch {
        setState("unsupported")
      }
    }
    checkStatus()
  }, [])

  async function subscribe() {
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
    setState("subscribed")
    toast.success("Đã bật thông báo đẩy")
  }

  async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) {
      await unsubscribeFromPushAction({ endpoint: subscription.endpoint })
      await subscription.unsubscribe()
    }
    setState("unsubscribed")
    toast.success("Đã tắt thông báo đẩy")
  }

  if (state === "checking" || state === "unsupported") return null

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-full"
      aria-label={state === "subscribed" ? "Tắt thông báo đẩy" : "Bật thông báo đẩy"}
      title={state === "subscribed" ? "Tắt thông báo đẩy" : "Bật thông báo đẩy cho thiết bị này"}
      onClick={state === "subscribed" ? unsubscribe : subscribe}
    >
      {state === "subscribed" ? <BellRingIcon className="size-5" /> : <BellOffIcon className="size-5" />}
    </Button>
  )
}
