import { z } from "zod"

export const subscribeToPushSchema = z.object({
  endpoint: z.string().url("Endpoint không hợp lệ"),
  p256dh: z.string().min(1, "Khoá p256dh không hợp lệ"),
  auth: z.string().min(1, "Khoá auth không hợp lệ"),
})
export type SubscribeToPushInput = z.infer<typeof subscribeToPushSchema>

export const unsubscribeFromPushSchema = z.object({
  endpoint: z.string().url("Endpoint không hợp lệ"),
})
export type UnsubscribeFromPushInput = z.infer<typeof unsubscribeFromPushSchema>
