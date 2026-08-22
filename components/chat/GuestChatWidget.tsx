"use client"

import { useEffect, useState } from "react"
import { MessageCircleIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatThread } from "@/components/chat/ChatThread"
import { getOrCreateChatSessionAction, getGuestChatHistoryAction, sendGuestChatMessageAction } from "@/actions/chat"
import { broadcastChatMessage, broadcastStaffInboxUpdate, type ChatMessagePayload } from "@/lib/chat-realtime"
import { isChatWindowOpen } from "@/lib/chat-window"

export type GuestRegistration = {
  id: string
  date: string
  startTime: string
  endTime: string
}

// Thanh nổi ở góc dưới-phải, chỉ hiện khi guest đang thực sự trong khung
// giờ ca đăng ký của họ — kiểm tra lại mỗi 30s bằng setInterval để widget
// tự biến mất ngay khi ca kết thúc, không cần guest tự đóng tay.
export function GuestChatWidget({ registration }: { registration: GuestRegistration }) {
  const [open, setOpen] = useState(false)
  const [windowOpen, setWindowOpen] = useState(() =>
    isChatWindowOpen(registration.date, registration.startTime, registration.endTime, new Date())
  )
  const [sessionId, setSessionId] = useState<string | null>(null)
  // Fetched once, together, before ChatThread ever mounts — ChatThread only
  // reads initialMessages at mount (see its own comment), so mounting it
  // before this history resolves would silently drop it, same class of bug
  // as the earlier "sent message doesn't appear" fix.
  const [history, setHistory] = useState<ChatMessagePayload[] | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setWindowOpen(isChatWindowOpen(registration.date, registration.startTime, registration.endTime, new Date()))
    }, 30_000)
    return () => clearInterval(interval)
  }, [registration])

  useEffect(() => {
    if (!open || sessionId) return
    Promise.all([getOrCreateChatSessionAction(registration.id), getGuestChatHistoryAction(registration.id)]).then(
      ([sessionResult, historyResult]) => {
        if (sessionResult.ok) {
          setSessionId(sessionResult.data.sessionId)
          // Staff should see this guest as soon as they open the widget —
          // not on a delay waiting for StaffChatWidget's own poll.
          void broadcastStaffInboxUpdate()
        }
        setHistory(historyResult.ok ? historyResult.data : [])
      }
    )
  }, [open, sessionId, registration.id])

  if (!windowOpen) return null

  async function handleSend(body: string): Promise<ChatMessagePayload | null> {
    if (!sessionId) return null
    const result = await sendGuestChatMessageAction({ registrationId: registration.id, body })
    if (!result.ok) return null
    const payload: ChatMessagePayload = { id: result.data.id, senderRole: "guest", body: result.data.body, createdAt: result.data.createdAt }
    // Fire-and-forget: this delivers the message to the staff side; the
    // guest's own bubble renders from the returned payload below, not from
    // this broadcast echoing back (see ChatThread's onSend contract).
    void broadcastChatMessage(sessionId, payload)
    return payload
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {open ? (
        <div className="flex h-96 w-80 flex-col rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b p-2">
            <span className="text-sm font-medium">Hỗ trợ trong ca học</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)}>
              <XIcon className="size-4" />
            </Button>
          </div>
          {sessionId && history ? (
            <ChatThread sessionId={sessionId} currentRole="guest" initialMessages={history} onSend={handleSend} disabled={false} />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Đang kết nối...</div>
          )}
        </div>
      ) : (
        <Button size="icon" className="size-12 rounded-full shadow-lg" onClick={() => setOpen(true)}>
          <MessageCircleIcon className="size-5" />
        </Button>
      )}
    </div>
  )
}
