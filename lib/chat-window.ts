// Client-side mirror of chat_session_is_open() (migration 0007, SQL) — this
// version runs without a network round-trip so the UI can hide/show a chat
// widget instantly. The RPC is still the source of truth (server always
// re-checks); this function only decides what to render.
export function isChatWindowOpen(date: string, startTime: string, endTime: string, now: Date): boolean {
  const start = new Date(`${date}T${startTime}:00+07:00`)
  const end = new Date(`${date}T${endTime}:00+07:00`)
  return now >= start && now < end
}
