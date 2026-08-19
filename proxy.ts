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

  const { data: { user } } = await supabase.auth.getClaims().then(
    (r) => ({ data: { user: r.data?.claims ? { id: r.data.claims.sub } : null } }),
    () => ({ data: { user: null } })
  )

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
