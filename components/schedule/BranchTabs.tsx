"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function BranchTabs({ branches, activeBranchId }: { branches: { id: string; name: string }[]; activeBranchId: string }) {
  const router = useRouter()
  const params = useSearchParams()

  function onChange(branchId: string) {
    const p = new URLSearchParams(params)
    p.set("branch", branchId)
    router.push(`/?${p.toString()}`)
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
