"use client"

import { useEffect, useOptimistic, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function BranchTabs({ branches, activeBranchId }: { branches: { id: string; name: string }[]; activeBranchId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  // Same reuse as DateNavigator: mounted by both "/" and "/noi-bo/lich", so the
  // target path must follow the current route rather than be hardcoded to "/".
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  // Switches the highlighted tab the instant it's clicked, instead of
  // waiting on the server round-trip that refetches the new branch's
  // schedule — activeBranchId only updates once that response lands, which
  // read as the tab "lagging" behind the click.
  const [optimisticBranchId, setOptimisticBranchId] = useOptimistic(activeBranchId)

  // There are only ever a couple of branches, so warming the router cache
  // for both of them on mount is cheap and means the actual click almost
  // always hits an already-fetched page instead of starting the request
  // fresh.
  useEffect(() => {
    for (const b of branches) {
      const p = new URLSearchParams(params)
      p.set("branch", b.id)
      router.prefetch(`${pathname}?${p.toString()}`)
    }
    // params/router intentionally excluded: this only needs to re-run when
    // the set of branches or the base path changes, not on every keystroke
    // of an unrelated search param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, pathname])

  function onChange(branchId: string) {
    const p = new URLSearchParams(params)
    p.set("branch", branchId)
    const href = `${pathname}?${p.toString()}`
    startTransition(() => {
      setOptimisticBranchId(branchId)
      router.push(href)
    })
  }

  return (
    <Tabs value={optimisticBranchId} onValueChange={onChange}>
      <TabsList>
        {branches.map((b) => (
          <TabsTrigger key={b.id} value={b.id}>{b.name}</TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
