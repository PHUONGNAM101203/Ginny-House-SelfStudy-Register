import type { Role } from "@/types"

export function canManage(role: Role): boolean {
  return role === "admin"
}
