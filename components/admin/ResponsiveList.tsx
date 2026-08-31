"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

const CARD_PAGE_SIZE = 4

/**
 * Desktop keeps the existing dense table; below `md` a wide table forces
 * horizontal scroll on a phone, so this swaps to a card grid instead —
 * showing CARD_PAGE_SIZE at a time with a "Xem thêm" button rather than
 * dumping every row at once (some of these lists run into the hundreds).
 */
export function ResponsiveList<T>({
  items,
  table,
  card,
  emptyMessage,
}: {
  items: T[]
  table: React.ReactNode
  card: (item: T, index: number) => React.ReactNode
  emptyMessage: string
}) {
  const [visibleCount, setVisibleCount] = useState(CARD_PAGE_SIZE)

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <>
      <div className="hidden md:block">{table}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:hidden">
        {items.slice(0, visibleCount).map((item, i) => card(item, i))}
      </div>
      {visibleCount < items.length && (
        <div className="mt-3 flex justify-center md:hidden">
          <Button variant="outline" size="sm" onClick={() => setVisibleCount((v) => v + CARD_PAGE_SIZE)}>
            Xem thêm ({items.length - visibleCount})
          </Button>
        </div>
      )}
    </>
  )
}
