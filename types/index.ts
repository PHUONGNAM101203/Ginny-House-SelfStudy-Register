export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type Role = "admin" | "quan_sinh"

export type Profile = {
  id: string
  fullName: string
  role: Role
}
