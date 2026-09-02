"use client"

import { useEffect, useRef, useState } from "react"
import { searchStudentsAction, type StudentSearchHit } from "@/actions/students"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Type-ahead over the Lark-synced student list, used by the booking form.
 *
 * One component serves both audiences because search_students (migration
 * 0021) decides per caller what comes back: staff see the phone, guests get
 * null and only fill in lớp. So the difference is enforced in the database,
 * not by trusting a prop on a client component.
 *
 * Matching is accent- and case-insensitive with trigram ranking, so "nguyen
 * van a" finds "Nguyễn Văn A".
 */
export function StudentAutocomplete({
  id,
  value,
  onValueChange,
  onSelect,
  placeholder,
  autoComplete = "off",
}: {
  id?: string
  value: string
  onValueChange: (value: string) => void
  onSelect: (hit: StudentSearchHit) => void
  placeholder?: string
  autoComplete?: string
}) {
  const [hits, setHits] = useState<StudentSearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  // Set when a hit is applied, so the effect below doesn't immediately
  // re-search for the exact name it just wrote back into the field.
  const justPicked = useRef(false)

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false
      return
    }
    const query = value.trim()
    if (query.length < 2) {
      setHits([])
      setOpen(false)
      return
    }
    const timeout = setTimeout(async () => {
      const result = await searchStudentsAction({ query })
      if (!result.ok) return
      setHits(result.data)
      setHighlighted(0)
      setOpen(result.data.length > 0)
    }, 250)
    return () => clearTimeout(timeout)
  }, [value])

  function pick(hit: StudentSearchHit) {
    justPicked.current = true
    onValueChange(hit.fullName)
    onSelect(hit)
    setOpen(false)
    setHits([])
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setHighlighted((i) => (i + 1) % hits.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setHighlighted((i) => (i - 1 + hits.length) % hits.length)
    } else if (event.key === "Enter") {
      // The whole dialog submits on Enter now (DialogForm / react-hook-form),
      // so an open suggestion list has to swallow it or picking a name would
      // book the slot in the same keystroke.
      event.preventDefault()
      pick(hits[highlighted])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        // A click on a suggestion would otherwise be eaten by the blur that
        // closes the list first.
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          {hits.map((hit, index) => (
            <li key={hit.id}>
              <button
                type="button"
                role="option"
                aria-selected={index === highlighted}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => pick(hit)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left text-sm",
                  index === highlighted ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                )}
              >
                <span className="w-full truncate font-medium">{hit.fullName}</span>
                {(hit.className || hit.phone) && (
                  <span className="w-full truncate text-xs text-muted-foreground">
                    {[hit.className, hit.phone].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
