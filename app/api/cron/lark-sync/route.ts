import { NextResponse } from "next/server"
import { syncStudentsFromLark } from "@/lib/lark/sync"

/**
 * Daily pull of the Lark Base student list, 06:00 giờ Việt Nam (see the cron
 * entry in vercel.json). Lark Bitable has no change webhook for this app's
 * plan, so "quét để tự động cập nhật" is a poll — the upsert is idempotent,
 * so a run where nothing changed is a no-op beyond the read.
 *
 * It used to run hourly. A class list does not change 24 times a day, and an
 * hourly wake-up is 720 billed invocations a month for nothing.
 */
// Fluid compute is switched off on this project (it was billing a warm
// instance around the clock), and without it Vercel's default function
// timeout drops from 300s to 15s. This route walks every page of the Lark
// table and upserts the lot, so it gets its own headroom rather than
// inheriting a limit meant for rendering a page.
export const maxDuration = 60
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await syncStudentsFromLark()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Đồng bộ Lark thất bại"
    console.error("lark sync failed:", message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
