import { getSessionProfile } from "@/lib/auth"
import { getNotificationSummary } from "@/lib/notifications/summary"
import { AppHeader } from "@/components/layout/AppHeader"
import { StaffChatWidget } from "@/components/chat/StaffChatWidget"

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
  const notifications = await getNotificationSummary(profile)
  return (
    <>
      <AppHeader profile={profile} notifications={notifications} />
      {/* w-full is load-bearing, not decorative: <main> is a direct flex
          item of <body className="flex h-full flex-col"> (app/layout.tsx).
          A flex item with mx-auto but no explicit width lets the auto
          margins absorb the cross-axis free space instead of the default
          align-items: stretch filling it — the box silently shrinks to its
          content's natural width instead of the intended max-w-[1600px]
          column (same class of flex-item-sizing gotcha as app/page.tsx's
          w-full min-w-0, just the opposite symptom: collapsing instead of
          overflowing). Found while widening this container off the back of
          a "dashboard looks cramped" report — without w-full here the wider
          max-width was a no-op, since content was already shrink-wrapped
          well below the old max-w-6xl too. */}
      <main className="mx-auto w-full max-w-[1600px] p-4">{children}</main>
      <StaffChatWidget />
    </>
  )
}
