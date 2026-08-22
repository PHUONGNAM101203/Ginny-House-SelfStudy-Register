"use client"

import { useEffect, useState } from "react"
import { MessageCircleIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatThread } from "@/components/chat/ChatThread"
import { getOrCreateChatSessionAction, sendGuestChatMessageAction } from "@/actions/chat"
import { broadcastChatMessage, type ChatMessagePayload } from "@/lib/chat-realtime"
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

  useEffect(() => {
    const interval = setInterval(() => {
      setWindowOpen(isChatWindowOpen(registration.date, registration.startTime, registration.endTime, new Date()))
    }, 30_000)
    return () => clearInterval(interval)
  }, [registration])

  useEffect(() => {
    if (!open || sessionId) return
    getOrCreateChatSessionAction(registration.id).then((result) => {
      if (result.ok) setSessionId(result.data.sessionId)
    })
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
          {sessionId ? (
            <ChatThread sessionId={sessionId} currentRole="guest" initialMessages={[]} onSend={handleSend} disabled={false} />
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
