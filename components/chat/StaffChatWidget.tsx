"use client"

import { useEffect, useState } from "react"
import { MessageCircleIcon, XIcon, ChevronLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatThread } from "@/components/chat/ChatThread"
import { getActiveChatSessionsAction, getStaffChatHistoryAction, sendStaffChatMessageAction, type ActiveChatSessionRow } from "@/actions/chat"
import { broadcastChatMessage, type ChatMessagePayload } from "@/lib/chat-realtime"
import { isChatWindowOpen } from "@/lib/chat-window"

const POLL_INTERVAL_MS = 30_000

// Floating popup at the same corner GuestChatWidget uses — mutually
// exclusive contexts (this renders only for a signed-in profile, that one
// only for a guest session), so the two never actually share a screen.
export function StaffChatWidget() {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<ActiveChatSessionRow[]>([])
  const [selected, setSelected] = useState<ActiveChatSessionRow | null>(null)
  const [history, setHistory] = useState<ChatMessagePayload[] | null>(null)

  useEffect(() => {
    async function refresh() {
      const result = await getActiveChatSessionsAction()
      if (result.ok) setSessions(result.data)
    }
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const openSessions = sessions.filter((s) => isChatWindowOpen(s.date, s.start_time, s.end_time, new Date()))

  async function selectSession(s: ActiveChatSessionRow) {
    setSelected(s)
    setHistory(null)
    const result = await getStaffChatHistoryAction(s.sessionId)
    setHistory(result.ok ? result.data : [])
  }

  async function handleSend(body: string): Promise<ChatMessagePayload | null> {
    if (!selected) return null
    const result = await sendStaffChatMessageAction({ sessionId: selected.sessionId, body })
    if (!result.ok) return null
    const payload: ChatMessagePayload = { id: result.data.id, senderRole: "staff", body: result.data.body, createdAt: result.data.createdAt }
    void broadcastChatMessage(selected.sessionId, payload)
    return payload
  }

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {open ? (
        <div className="flex h-96 w-80 flex-col rounded-lg border bg-background shadow-lg">
          <div className="flex items-center gap-1 border-b p-2">
            {selected && (
              <Button variant="ghost" size="icon-sm" onClick={() => setSelected(null)} aria-label="Quay lại danh sách">
                <ChevronLeftIcon className="size-4" />
              </Button>
            )}
            <span className="flex-1 truncate text-sm font-medium">
              {selected ? `${selected.student_name}${selected.class_name ? ` · ${selected.class_name}` : ""}` : "Chat với học sinh"}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Đóng">
              <XIcon className="size-4" />
            </Button>
          </div>
          {selected ? (
            history ? (
              <ChatThread key={selected.sessionId} sessionId={selected.sessionId} currentRole="staff" initialMessages={history} onSend={handleSend} disabled={false} />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Đang tải...</div>
            )
          ) : openSessions.length === 0 ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
              Không có phiên chat nào đang mở.
            </div>
          ) : (
            <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
              {openSessions.map((s) => (
                <li key={s.sessionId}>
                  <button
                    className="w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
                    onClick={() => selectSession(s)}
                  >
                    <div className="font-medium">{s.student_name}</div>
                    {s.class_name && <div className="text-xs text-muted-foreground">{s.class_name}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <Button size="icon" className="relative size-12 rounded-full shadow-lg" onClick={() => setOpen(true)}>
          <MessageCircleIcon className="size-5" />
          {openSessions.length > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
              {openSessions.length}
            </span>
          )}
        </Button>
      )}
    </div>
  )
}
