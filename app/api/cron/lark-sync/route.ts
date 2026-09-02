import { NextResponse } from "next/server"
import { syncStudentsFromLark } from "@/lib/lark/sync"

/**
 * Hourly pull of the Lark Base student list (see the cron entry in
 * vercel.json). Lark Bitable has no change webhook for this app's plan, so
 * "quét để tự động cập nhật" is a poll — the upsert is idempotent, so a run
 * where nothing changed is a no-op beyond the read.
 */
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
