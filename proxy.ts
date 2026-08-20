import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of list) response.cookies.set(name, value, options)
        },
      },
    }
  )

  // getUser() (not getClaims()) on purpose: getClaims only verifies the JWT's
  // signature and expiry locally, so it still reports a "user" for a session whose
  // auth user has since been deleted or revoked. lib/auth.ts validates server-side
  // via getUser(), and any disagreement between the two layers is an unrecoverable
  // redirect loop — this gate sends the session to /noi-bo/lich while requireProfile
  // sends it straight back to /noi-bo/dang-nhap, and the user cannot even reach the
  // login page to fix it. Both layers now ask the same authority. Costs one auth
  // round-trip per matched request, which is the documented @supabase/ssr pattern.
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))

  const path = request.nextUrl.pathname
  const isInternal = path.startsWith("/noi-bo") && path !== "/noi-bo/dang-nhap"

  if (isInternal && !user) {
    return NextResponse.redirect(new URL("/noi-bo/dang-nhap", request.url))
  }
  if (path === "/noi-bo/dang-nhap" && user) {
    return NextResponse.redirect(new URL("/noi-bo/lich", request.url))
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
}
