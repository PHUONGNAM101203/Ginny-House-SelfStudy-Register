"use client"

import { useState } from "react"
import { ChatThread } from "@/components/chat/ChatThread"
import { sendStaffChatMessageAction, getStaffChatHistoryAction } from "@/actions/chat"
import { broadcastChatMessage, type ChatMessagePayload } from "@/lib/chat-realtime"
import { isChatWindowOpen } from "@/lib/chat-window"

type Row = {
  sessionId: string
  id: string
  student_name: string
  class_name: string | null
  date: string
  start_time: string
  end_time: string
}

// chat_sessions.status only ever flips to 'ended' if something explicitly
// updates it (nothing does yet — see chat plan Task 1's comment on
// chat_session_is_open), so "status = active" rows can include sessions
// whose slot has already passed. Filter those out client-side with the same
// isChatWindowOpen the guest widget uses, so staff and guest agree on what
// "still open" means.
export function StaffChatPanel({ rows }: { rows: Row[] }) {
  const openRows = rows.filter((r) => isChatWindowOpen(r.date, r.start_time, r.end_time, new Date()))
  const [selected, setSelected] = useState<Row | null>(null)
  // null = history for the current selection hasn't loaded yet. ChatThread
  // only reads initialMessages once at mount, so it must not render until
  // this is ready (see GuestChatWidget's identical fix and comment).
  const [history, setHistory] = useState<ChatMessagePayload[] | null>(null)

  if (openRows.length === 0) {
    return <p className="text-sm text-muted-foreground">Không có phiên chat nào đang mở.</p>
  }

  async function selectRow(r: Row) {
    setSelected(r)
    setHistory(null)
    const result = await getStaffChatHistoryAction(r.sessionId)
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      <ul className="flex flex-col gap-1">
        {openRows.map((r) => (
          <li key={r.sessionId}>
            <button
              className="w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
              onClick={() => selectRow(r)}
            >
              <div className="font-medium">{r.student_name}</div>
              {r.class_name && <div className="text-xs text-muted-foreground">{r.class_name}</div>}
            </button>
          </li>
        ))}
      </ul>
      <div className="h-[500px] rounded-lg border">
        {selected && history ? (
          <ChatThread key={selected.sessionId} sessionId={selected.sessionId} currentRole="staff" initialMessages={history} onSend={handleSend} disabled={false} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chọn một cuộc chat để bắt đầu</div>
        )}
      </div>
    </div>
  )
}
