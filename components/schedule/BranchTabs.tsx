"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function BranchTabs({ branches, activeBranchId }: { branches: { id: string; name: string }[]; activeBranchId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  // Same reuse as DateNavigator: mounted by both "/" and "/noi-bo/lich", so the
  // target path must follow the current route rather than be hardcoded to "/".
  const pathname = usePathname()

  function onChange(branchId: string) {
    const p = new URLSearchParams(params)
    p.set("branch", branchId)
    router.push(`${pathname}?${p.toString()}`)
  }

  return (
    <Tabs value={activeBranchId} onValueChange={onChange}>
      <TabsList>
        {branches.map((b) => (
          <TabsTrigger key={b.id} value={b.id}>{b.name}</TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
