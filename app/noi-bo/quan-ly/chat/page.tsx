import { requireProfile } from "@/lib/auth"
import { getActiveChatSessionsAction } from "@/actions/chat"
import { StaffChatPanel } from "@/components/chat/StaffChatPanel"

// Not requireAdmin — both admin and quan_sinh can see/respond to chat,
// unlike the change-request review page which is admin-only. Reachable via
// the chat_message notification link and directly — the floating
// StaffChatWidget (rendered on every internal page) is the faster everyday
// path, this full page is for when a bigger view is useful.
export default async function ChatInboxPage() {
  await requireProfile()
  const result = await getActiveChatSessionsAction()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Chat với học sinh</h1>
      <StaffChatPanel rows={result.ok ? result.data : []} />
    </div>
  )
}
