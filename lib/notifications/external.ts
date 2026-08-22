// Not wired to any provider or call site yet — scaffolding only, per Gin
// Anh's request to have email and Zalo OA "ready to plug in" later without
// building the actual integration now. When a real provider is chosen, swap
// the function body; the payload shape and call sites elsewhere stay the same.

export type ExternalNotificationPayload = {
  studentName: string
  phone: string
  zaloContact?: string
  message: string
}

export async function sendEmailNotification(_payload: ExternalNotificationPayload): Promise<void> {
  // TODO: wire to an email provider (e.g. Resend) once credentials exist.
}

export async function sendZaloNotification(_payload: ExternalNotificationPayload): Promise<void> {
  // TODO: wire to the Zalo OA API once the OA is approved and a token exists.
}
