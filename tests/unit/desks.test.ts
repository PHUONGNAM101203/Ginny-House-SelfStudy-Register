import { describe, it, expect } from "vitest"
import { compareDeskLabels, sortDesks } from "@/lib/desks"

describe("compareDeskLabels", () => {
  it("orders the trailing number numerically, not lexicographically", () => {
    // The reported bug: a plain string sort puts "Chỗ 10" between 1 and 2.
    const labels = ["Chỗ 10", "Chỗ 2", "Chỗ 1", "Chỗ 9"]
    expect([...labels].sort(compareDeskLabels)).toEqual(["Chỗ 1", "Chỗ 2", "Chỗ 9", "Chỗ 10"])
  })

  it("handles a full 1..12 run in one pass", () => {
    const labels = Array.from({ length: 12 }, (_, i) => `Chỗ ${i + 1}`)
    const shuffled = [...labels].sort() // lexicographic on purpose
    expect(shuffled.sort(compareDeskLabels)).toEqual(labels)
  })

  it("groups by prefix before comparing numbers", () => {
    const labels = ["B 2", "A 10", "A 2", "B 1"]
    expect([...labels].sort(compareDeskLabels)).toEqual(["A 2", "A 10", "B 1", "B 2"])
  })

  it("falls back to a locale compare when there is no trailing number", () => {
    const labels = ["Ghế phụ", "Bàn dài", "Chỗ 3"]
    expect([...labels].sort(compareDeskLabels)).toEqual(["Bàn dài", "Chỗ 3", "Ghế phụ"])
  })

  it("stays transitive when a suffixed label joins a numbered family", () => {
    // The hand-rolled trailing-digits comparator this replaced was
    // intransitive here (9 < 10, 10 < 10b, but 9 > 10b), which makes
    // Array.sort's result implementation-defined. Desk labels are free text,
    // so "Chỗ 10b" is a shape an admin can actually create.
    expect(compareDeskLabels("Chỗ 9", "Chỗ 10")).toBeLessThan(0)
    expect(compareDeskLabels("Chỗ 10", "Chỗ 10b")).toBeLessThan(0)
    expect(compareDeskLabels("Chỗ 9", "Chỗ 10b")).toBeLessThan(0)
    expect(["Chỗ 10b", "Chỗ 9", "Chỗ 10"].sort(compareDeskLabels)).toEqual([
      "Chỗ 9",
      "Chỗ 10",
      "Chỗ 10b",
    ])
  })

  it("treats an equal label as equal", () => {
    expect(compareDeskLabels("Chỗ 4", "Chỗ 4")).toBe(0)
  })
})

describe("sortDesks", () => {
  it("returns a new array and leaves the input untouched", () => {
    const desks = [{ id: "b", label: "Chỗ 10" }, { id: "a", label: "Chỗ 2" }]
    const sorted = sortDesks(desks)
    expect(sorted.map((d) => d.id)).toEqual(["a", "b"])
    expect(desks.map((d) => d.id)).toEqual(["b", "a"])
    expect(sorted).not.toBe(desks)
  })
})
