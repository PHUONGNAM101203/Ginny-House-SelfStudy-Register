import { describe, it, expect } from "vitest"
import { larkFieldToText, normalizePhone, mapLarkRecords, type LarkRecord } from "@/lib/lark/map"
import { parseLarkBaseUrl } from "@/lib/lark/config"

const fields = { fullName: "Họ và tên", phone: "Số điện thoại", status: "Trạng thái học sinh" }

describe("larkFieldToText", () => {
  it("reads a plain text cell", () => {
    expect(larkFieldToText("Nguyễn Văn A")).toBe("Nguyễn Văn A")
  })

  it("joins the segments of a rich-text cell", () => {
    expect(larkFieldToText([{ type: "text", text: "Nguyễn " }, { type: "text", text: "Văn A" }])).toBe("Nguyễn Văn A")
  })

  it("reads the display name out of a person cell", () => {
    expect(larkFieldToText([{ id: "ou_1", name: "Trần Thị B" }])).toBe("Trần Thị B")
  })

  it("reads a number cell without turning it into scientific notation", () => {
    expect(larkFieldToText(912345678)).toBe("912345678")
  })

  it("returns empty for an empty cell rather than 'undefined'", () => {
    expect(larkFieldToText(null)).toBe("")
    expect(larkFieldToText(undefined)).toBe("")
  })
})

describe("normalizePhone", () => {
  it.each([
    ["0912 345 678", "0912345678"],
    ["0912.345.678", "0912345678"],
    ["0912-345-678", "0912345678"],
    ["+84912345678", "0912345678"],
    ["84912345678", "0912345678"],
    ["0912345678", "0912345678"],
  ])("normalises %s to %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it("restores the leading zero a number column ate", () => {
    expect(normalizePhone("912345678")).toBe("0912345678")
  })
})

describe("mapLarkRecords", () => {
  const record = (id: string, name: unknown, phone: unknown, status?: string): LarkRecord => ({
    record_id: id,
    fields: { "Họ và tên": name, "Số điện thoại": phone, "Trạng thái học sinh": status ?? "" },
  })

  it("maps a clean row through", () => {
    const { students, skipped } = mapLarkRecords([record("rec1", "Nguyễn Văn A", "0912 345 678")], fields)
    expect(skipped).toEqual([])
    expect(students).toEqual([{ fullName: "Nguyễn Văn A", phone: "0912345678", larkRecordId: "rec1" }])
  })

  it("skips a row with no name instead of importing a nameless student", () => {
    const { students, skipped } = mapLarkRecords([record("rec1", "", "0912345678")], fields)
    expect(students).toEqual([])
    expect(skipped[0]).toMatchObject({ recordId: "rec1", reason: "thiếu họ tên" })
  })

  it("skips a row whose phone is unusable — it is the upsert key", () => {
    const { students, skipped } = mapLarkRecords([record("rec1", "Nguyễn Văn A", "abc")], fields)
    expect(students).toEqual([])
    expect(skipped[0].reason).toContain("số điện thoại không hợp lệ")
  })

  it("keeps the first of two rows sharing a phone and reports the second", () => {
    const { students, skipped } = mapLarkRecords(
      [record("rec1", "Nguyễn Văn A", "0912345678"), record("rec2", "Trần Thị B", "+84912345678")],
      fields
    )
    expect(students).toHaveLength(1)
    expect(students[0].larkRecordId).toBe("rec1")
    expect(skipped[0]).toMatchObject({ recordId: "rec2" })
    expect(skipped[0].reason).toContain("trùng số điện thoại")
  })

  it("handles an empty base without throwing", () => {
    expect(mapLarkRecords([], fields)).toEqual({ students: [], skipped: [], filteredOut: 0 })
  })
})

describe("mapLarkRecords with a status allowlist", () => {
  const record = (id: string, name: string, phone: string, status: string): LarkRecord => ({
    record_id: id,
    fields: { "Họ và tên": name, "Số điện thoại": phone, "Trạng thái học sinh": status },
  })

  // The Base is the centre's whole CRM: leads who never enrolled, alumni, and
  // students who left all sit in the same table as the ones actually studying.
  const rows = [
    record("rec1", "Đang Học A", "0900000001", "Đang học"),
    record("rec2", "Cho Lop B", "0900000002", "Đang chờ lớp"),
    record("rec3", "Xong C", "0900000003", "Đã học xong"),
    record("rec4", "Nghi D", "0900000004", "Đã nghỉ"),
    record("rec5", "Lead E", "0900000005", ""),
  ]

  it("keeps only the allowed statuses and counts the rest", () => {
    const { students, filteredOut } = mapLarkRecords(rows, fields, ["Đang học", "Đang chờ lớp"])
    expect(students.map((s) => s.larkRecordId)).toEqual(["rec1", "rec2"])
    expect(filteredOut).toBe(3)
  })

  it("counts excluded rows rather than listing them as skipped", () => {
    // A thousand-lead CRM would otherwise drown the skipped list in noise.
    const { skipped } = mapLarkRecords(rows, fields, ["Đang học"])
    expect(skipped).toEqual([])
  })

  it("syncs everything when the allowlist is empty", () => {
    const { students, filteredOut } = mapLarkRecords(rows, fields, [])
    expect(students).toHaveLength(5)
    expect(filteredOut).toBe(0)
  })

  it("excludes a blank status, which is what a pure lead looks like", () => {
    const { students } = mapLarkRecords(rows, fields, ["Đang học"])
    expect(students.map((s) => s.fullName)).toEqual(["Đang Học A"])
  })
})

describe("parseLarkBaseUrl", () => {
  it("pulls the app token and table id out of a Base URL", () => {
    expect(parseLarkBaseUrl("https://acme.larksuite.com/base/BasABCDEF123?table=tblXYZ789&view=vewQ1")).toEqual({
      appToken: "BasABCDEF123",
      tableId: "tblXYZ789",
    })
  })

  it("returns a null table id when the URL doesn't name one", () => {
    expect(parseLarkBaseUrl("https://acme.larksuite.com/base/BasABCDEF123")).toEqual({
      appToken: "BasABCDEF123",
      tableId: null,
    })
  })

  it("returns null for a URL that isn't a Base", () => {
    expect(parseLarkBaseUrl("https://acme.larksuite.com/docs/doccnXYZ")).toBeNull()
  })
})
