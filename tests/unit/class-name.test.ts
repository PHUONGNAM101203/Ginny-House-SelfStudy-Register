import { describe, it, expect } from "vitest"
import { normalizeClassName } from "@/lib/class-name"

describe("normalizeClassName", () => {
  it("normalizes an already-canonical value unchanged", () => {
    expect(normalizeClassName("L1-04-26")).toBe("L1-04-26")
  })

  it("normalizes lowercase with spaces", () => {
    expect(normalizeClassName("l1 04 26")).toBe("L1-04-26")
  })

  it("normalizes mixed case with dashes", () => {
    expect(normalizeClassName("l1-04-26")).toBe("L1-04-26")
  })

  it("pads single-digit groups to two digits", () => {
    expect(normalizeClassName("L1-4-26")).toBe("L1-04-26")
    expect(normalizeClassName("l2 4 5")).toBe("L2-04-05")
  })

  it("defaults to L prefix when no letter is typed", () => {
    expect(normalizeClassName("1-04-26")).toBe("L1-04-26")
  })

  it("trims surrounding whitespace", () => {
    expect(normalizeClassName("  L1-04-26  ")).toBe("L1-04-26")
  })

  it("returns an empty string unchanged", () => {
    expect(normalizeClassName("")).toBe("")
  })

  it("falls back to uppercase-only when the shape does not match 3 number groups", () => {
    expect(normalizeClassName("chua ro lop")).toBe("CHUA RO LOP")
  })
})
