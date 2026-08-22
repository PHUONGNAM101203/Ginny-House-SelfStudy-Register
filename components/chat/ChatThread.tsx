"use client"

import { useEffect, useRef, useState } from "react"
import { SendIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { subscribeToChatChannel, type ChatMessagePayload } from "@/lib/chat-realtime"

export function ChatThread({
  sessionId,
  currentRole,
  initialMessages,
  onSend,
  disabled,
  disabledReason,
}: {
  sessionId: string
  currentRole: "guest" | "staff"
  initialMessages: ChatMessagePayload[]
  onSend: (body: string) => Promise<void>
  disabled: boolean
  disabledReason?: string
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    return subscribeToChatChannel(sessionId, (msg) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
    })
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  async function handleSend() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setDraft("")
    try {
      await onSend(body)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[80%] rounded-lg px-3 py-2 text-sm",
              m.senderRole === currentRole ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
            )}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex items-center gap-2 border-t p-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={disabled ? (disabledReason ?? "Không thể gửi") : "Nhập tin nhắn..."}
          disabled={disabled || sending}
        />
        <Button size="icon-sm" onClick={handleSend} disabled={disabled || sending || !draft.trim()}>
          <SendIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
