"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const PAGE_SIZE = 4

/**
 * Sibling of ResponsiveList, for lists where the card grid is the layout at
 * every width rather than only the small-screen fallback — the desk list per
 * cơ sở being the case that prompted it (Gin Anh: a flat table of every desk
 * at both cơ sở ran off the bottom of the screen).
 *
 * Two per row, PAGE_SIZE at a time, "Xem thêm" for the rest. `resetKey`
 * collapses the list back to the first page when the caller switches to a
 * different data set — without it, opening a 30-desk tab and then a 4-desk
 * one leaves the second tab in a permanently expanded state.
 */
export function PagedCardGrid<T>({
  items,
  card,
  emptyMessage,
  resetKey,
}: {
  items: T[]
  card: (item: T, index: number) => React.ReactNode
  emptyMessage: string
  resetKey?: string
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [seenKey, setSeenKey] = useState(resetKey)

  if (resetKey !== seenKey) {
    setSeenKey(resetKey)
    setVisibleCount(PAGE_SIZE)
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.slice(0, visibleCount).map((item, i) => card(item, i))}
      </div>
      {visibleCount < items.length && (
        <div className="mt-3 flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
            Xem thêm ({items.length - visibleCount})
          </Button>
        </div>
      )}
    </>
  )
}
