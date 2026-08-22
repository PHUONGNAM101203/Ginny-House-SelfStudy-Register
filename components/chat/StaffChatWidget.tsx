"use client"

import { useEffect, useState } from "react"
import { MessageCircleIcon, XIcon, ChevronLeftIcon, UsersIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChatThread } from "@/components/chat/ChatThread"
import {
  getActiveChatSessionsAction,
  getStaffChatHistoryAction,
  getStaffRoomHistoryAction,
  sendStaffChatMessageAction,
  sendStaffRoomMessageAction,
  type ActiveChatSessionRow,
} from "@/actions/chat"
import { broadcastChatMessage, subscribeToStaffInbox, type ChatMessagePayload } from "@/lib/chat-realtime"
import { isChatWindowOpen } from "@/lib/chat-window"
import type { Profile } from "@/types"

const POLL_INTERVAL_MS = 30_000
const STAFF_ROOM_CHANNEL = "staff-room"

type Selection = { type: "staff-room" } | { type: "guest"; session: ActiveChatSessionRow }

// Floating popup at the same corner GuestChatWidget uses — mutually
// exclusive contexts (this renders only for a signed-in profile, that one
// only for a guest session), so the two never actually share a screen.
//
// The list always opens on two things: the internal admin<->quan_sinh room
// (standing, not tied to any booking) and, grouped by cơ sở, whichever
// guests are currently inside their booked slot.
export function StaffChatWidget({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<ActiveChatSessionRow[]>([])
  const [selection, setSelection] = useState<Selection | null>(null)
  const [history, setHistory] = useState<ChatMessagePayload[] | null>(null)

  useEffect(() => {
    async function refresh() {
      const result = await getActiveChatSessionsAction()
      if (result.ok) setSessions(result.data)
    }
    refresh()
    // The 30s poll is a fallback (covers a broadcast missed while this
    // widget's socket was reconnecting) — the staff-inbox broadcast is what
    // actually makes a waiting guest show up immediately instead of on a
    // delay (see GuestChatWidget, which fires it the moment a guest opens
    // their own widget).
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    const unsubscribe = subscribeToStaffInbox(refresh)
    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [])

  const openSessions = sessions.filter((s) => isChatWindowOpen(s.date, s.start_time, s.end_time, new Date()))
  const branchNames = [...new Set(openSessions.map((s) => s.branch_name))]

  async function selectStaffRoom() {
    setSelection({ type: "staff-room" })
    setHistory(null)
    const result = await getStaffRoomHistoryAction()
    setHistory(result.ok ? result.data : [])
  }

  async function selectGuestSession(session: ActiveChatSessionRow) {
    setSelection({ type: "guest", session })
    setHistory(null)
    const result = await getStaffChatHistoryAction(session.sessionId)
    setHistory(result.ok ? result.data : [])
  }

  async function handleSend(body: string): Promise<ChatMessagePayload | null> {
    if (!selection) return null
    if (selection.type === "staff-room") {
      const result = await sendStaffRoomMessageAction({ body })
      if (!result.ok) return null
      void broadcastChatMessage(STAFF_ROOM_CHANNEL, result.data)
      return result.data
    }
    const result = await sendStaffChatMessageAction({ sessionId: selection.session.sessionId, body })
    if (!result.ok) return null
    const payload: ChatMessagePayload = { id: result.data.id, senderRole: "staff", body: result.data.body, createdAt: result.data.createdAt }
    void broadcastChatMessage(selection.session.sessionId, payload)
    return payload
  }

  // Labeled from the viewer's own side — an admin sees "Quản sinh" (who
  // they'd be talking to), not a generic "Nội bộ" that doesn't say who's on
  // the other end; quan_sinh sees "Admin" for the same reason.
  const counterpartRoleLabel = profile.role === "admin" ? "Quản sinh" : "Admin"

  const panelTitle =
    selection?.type === "staff-room"
      ? counterpartRoleLabel
      : selection?.type === "guest"
        ? `${selection.session.student_name}${selection.session.class_name ? ` · ${selection.session.class_name}` : ""}`
        : "Messenger"

  return (
    <div className="fixed right-4 bottom-4 z-50">
      {open ? (
        <div className="flex h-96 w-80 flex-col rounded-lg border bg-background shadow-lg">
          <div className="flex items-center gap-1 border-b p-2">
            {selection && (
              <Button variant="ghost" size="icon-sm" onClick={() => setSelection(null)} aria-label="Quay lại danh sách">
                <ChevronLeftIcon className="size-4" />
              </Button>
            )}
            <span className="flex-1 truncate text-sm font-medium">{panelTitle}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Đóng">
              <XIcon className="size-4" />
            </Button>
          </div>
          {selection ? (
            history ? (
              <ChatThread
                key={selection.type === "staff-room" ? "staff-room" : selection.session.sessionId}
                sessionId={selection.type === "staff-room" ? STAFF_ROOM_CHANNEL : selection.session.sessionId}
                currentRole="staff"
                currentSenderId={selection.type === "staff-room" ? profile.id : undefined}
                initialMessages={history}
                onSend={handleSend}
                disabled={false}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Đang tải...</div>
            )
          ) : (
            <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
              {/* Always present, regardless of any active guest — admin and
                  quan_sinh should always be able to reach each other. */}
              <li>
                <button
                  className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm hover:bg-accent"
                  onClick={selectStaffRoom}
                >
                  <UsersIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="font-medium">{counterpartRoleLabel}</span>
                </button>
              </li>
              {branchNames.map((branchName) => (
                <li key={branchName} className="flex flex-col gap-1">
                  <span className="mt-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{branchName}</span>
                  <ul className="flex flex-col gap-1">
                    {openSessions
                      .filter((s) => s.branch_name === branchName)
                      .map((s) => (
                        <li key={s.sessionId}>
                          <button
                            className="w-full rounded-md border p-2 text-left text-sm hover:bg-accent"
                            onClick={() => selectGuestSession(s)}
                          >
                            <div className="font-medium">{s.student_name}</div>
                            {s.class_name && <div className="text-xs text-muted-foreground">{s.class_name}</div>}
                          </button>
                        </li>
                      ))}
                  </ul>
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
