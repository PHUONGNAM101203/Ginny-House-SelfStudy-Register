import type { LarkConfig } from "@/lib/lark/config"
import type { LarkRecord } from "@/lib/lark/map"

type LarkResponse<T> = { code: number; msg: string; data?: T }

async function larkFetch<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Lark API ${response.status} ${response.statusText} for ${new URL(url).pathname}`)
  }
  const body = (await response.json()) as LarkResponse<T>
  // Lark answers 200 with a non-zero `code` for auth and permission errors,
  // so response.ok alone never catches a wrong app secret or a base the app
  // hasn't been added to.
  if (body.code !== 0) {
    throw new Error(`Lark API error ${body.code}: ${body.msg}`)
  }
  // Two response shapes: most endpoints nest the payload under `data`, but
  // the tenant_access_token endpoint puts `tenant_access_token`/`expire` at
  // the top level next to code/msg. Requiring `data` rejected a perfectly
  // good token response as "Lark API error 0: ok".
  return (body.data ?? (body as unknown as T)) as T
}

export async function getTenantAccessToken(config: LarkConfig): Promise<string> {
  const data = await larkFetch<{ tenant_access_token: string }>(
    `${config.baseUrl}/open-apis/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: config.appId, app_secret: config.appSecret }),
      cache: "no-store",
    }
  )
  return data.tenant_access_token
}

/** Walks every page — the base is expected to outgrow one page of 500. */
export async function listBitableRecords(config: LarkConfig, token: string): Promise<LarkRecord[]> {
  const records: LarkRecord[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(
      `${config.baseUrl}/open-apis/bitable/v1/apps/${config.appToken}/tables/${config.tableId}/records`
    )
    url.searchParams.set("page_size", "500")
    if (pageToken) url.searchParams.set("page_token", pageToken)

    const data = await larkFetch<{ items?: LarkRecord[]; has_more?: boolean; page_token?: string }>(
      url.toString(),
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    )

    records.push(...(data.items ?? []))
    pageToken = data.has_more ? data.page_token : undefined
  } while (pageToken)

  return records
}
