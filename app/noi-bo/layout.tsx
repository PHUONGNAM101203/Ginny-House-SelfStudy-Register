import { getSessionProfile } from "@/lib/auth"
import { AppHeader } from "@/components/layout/AppHeader"

// This layout wraps every route under /noi-bo/*, including /noi-bo/dang-nhap
// itself (Next.js layouts wrap all filesystem descendants — there is no way
// for a page to opt out while staying a sibling under the same URL prefix).
// Calling requireProfile() here would redirect an unauthenticated visitor to
// /noi-bo/dang-nhap, which is itself wrapped by this same layout — an
// infinite redirect loop on the login page.
//
// proxy.ts (Task 5) already gates every /noi-bo/* route except
// /noi-bo/dang-nhap, redirecting unauthenticated requests before they ever
// reach this layout, and redirects authenticated requests away from
// /noi-bo/dang-nhap. So by the time this component renders, a null profile
// can only happen on /noi-bo/dang-nhap (or a rare token-expiry race on a
// protected page) — in either case we simply render children without the
// header instead of redirecting again.
export default async function InternalLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile()
  if (!profile) {
    return <>{children}</>
  }
  return (
    <>
      <AppHeader profile={profile} />
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </>
  )
}
