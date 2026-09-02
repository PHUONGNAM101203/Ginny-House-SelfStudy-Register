export type LarkConfig = {
  baseUrl: string
  appId: string
  appSecret: string
  appToken: string
  tableId: string
  fieldNames: { fullName: string; phone: string; status: string; classFields: string[] }
  /**
   * Which values of the status column count as "a student this app cares
   * about". Empty = no filtering (every row syncs).
   */
  statusAllowlist: string[]
}

/**
 * Returns null when Lark isn't configured, rather than throwing — the sync
 * route has to be deployable before the credentials exist, and a missing
 * config is "feature off", not "server broken".
 */
export function readLarkConfig(): LarkConfig | null {
  const appId = process.env.LARK_APP_ID
  const appSecret = process.env.LARK_APP_SECRET
  const appToken = process.env.LARK_BASE_APP_TOKEN
  const tableId = process.env.LARK_BASE_TABLE_ID
  if (!appId || !appSecret || !appToken || !tableId) return null

  return {
    // Vietnam uses the international tenant (larksuite.com); the mainland
    // one is open.feishu.cn. Overridable rather than hard-coded because the
    // token endpoint 404s on the wrong domain with no useful message.
    baseUrl: process.env.LARK_BASE_URL ?? "https://open.larksuite.com",
    appId,
    appSecret,
    appToken,
    tableId,
    fieldNames: {
      fullName: process.env.LARK_FIELD_FULL_NAME ?? "Họ và tên học sinh",
      phone: process.env.LARK_FIELD_PHONE ?? "Số điện thoại",
      status: process.env.LARK_FIELD_STATUS ?? "Trạng thái học sinh",
      classFields: (process.env.LARK_FIELD_CLASS ?? "Lớp GH đã/đang học,Lớp học thử,Lớp đang chờ ?")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    },
    // The Base is the centre's whole CRM — leads who never enrolled, students
    // who finished, students who quit — so an unfiltered sync would fill the
    // self-study register with people who can't book anything. Comma-separated
    // so the office can widen or narrow it without a deploy.
    statusAllowlist: (process.env.LARK_STATUS_ALLOWLIST ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  }
}

/**
 * A Lark Base URL looks like
 * https://xxx.larksuite.com/base/<appToken>?table=<tableId>&view=<viewId>
 * — this pulls the two ids out so they can be pasted straight into the env
 * vars without hunting through the API docs.
 */
export function parseLarkBaseUrl(url: string): { appToken: string; tableId: string | null } | null {
  const match = url.match(/\/(?:base|wiki)\/([A-Za-z0-9]+)/)
  if (!match) return null
  const tableId = new URL(url).searchParams.get("table")
  return { appToken: match[1], tableId }
}
