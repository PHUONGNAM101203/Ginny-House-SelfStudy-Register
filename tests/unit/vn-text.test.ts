import { describe, it, expect } from "vitest"
import { foldVietnamese, matchesAllTerms } from "@/lib/vn-text"

describe("foldVietnamese", () => {
  it("strips tone marks and lowercases", () => {
    expect(foldVietnamese("Nguyễn Văn A")).toBe("nguyen van a")
    expect(foldVietnamese("NGUYỄN VĂN A")).toBe("nguyen van a")
  })

  it("handles đ, which is a letter and not a combining mark", () => {
    expect(foldVietnamese("Lê Hoàng Đức")).toBe("le hoang duc")
    expect(foldVietnamese("đường")).toBe("duong")
  })

  it("folds every Vietnamese vowel family", () => {
    expect(foldVietnamese("ăâêôơưáàảãạ")).toBe("aaeoouaaaaa")
  })

  it("trims surrounding whitespace", () => {
    expect(foldVietnamese("  Bùi Khánh Ly  ")).toBe("bui khanh ly")
  })
})

describe("matchesAllTerms", () => {
  it("matches regardless of accents or case", () => {
    expect(matchesAllTerms("Nguyễn Văn A", "nguyen van a")).toBe(true)
    expect(matchesAllTerms("nguyen van a", "NGUYỄN")).toBe(true)
  })

  it("matches terms out of order and in the middle of the name", () => {
    expect(matchesAllTerms("Trần Thị Bích Ngọc", "ngoc tran")).toBe(true)
    expect(matchesAllTerms("Trần Thị Bích Ngọc", "bich")).toBe(true)
  })

  it("requires every term, not just one", () => {
    expect(matchesAllTerms("Trần Thị Bích Ngọc", "bich phuong")).toBe(false)
  })

  it("treats an empty query as matching everything", () => {
    expect(matchesAllTerms("Bất kỳ ai", "")).toBe(true)
  })

  it("searches phone numbers in the same haystack", () => {
    expect(matchesAllTerms("Bùi Hoàng Anh 0946220179", "0946")).toBe(true)
  })
})
