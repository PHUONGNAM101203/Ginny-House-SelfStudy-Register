/**
 * The bookings made from this browser, so the guest calendar can tell "your
 * booking" (full details, can ask to cancel) from "someone else's" (details
 * only, with a warning).
 *
 * Guests have no account, so this is the only handle they have. It is a
 * convenience, never a permission: the server never trusts it — cancelling
 * still goes through the phiếu an admin reviews, and the calendar shows the
 * same fields to everyone either way.
 */
const KEY = "myRegistrationIds"

export function readMyRegistrationIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [])
  } catch {
    // Corrupt or unreadable storage must not take the calendar down with it.
    return new Set()
  }
}

export function rememberMyRegistration(id: string): void {
  if (typeof window === "undefined") return
  const ids = readMyRegistrationIds()
  ids.add(id)
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...ids]))
  } catch {
    // Private browsing / quota — the booking itself already succeeded.
  }
}
