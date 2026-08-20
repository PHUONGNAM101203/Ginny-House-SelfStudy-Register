"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon, Loader2Icon, ArrowRightIcon } from "lucide-react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import BrandMark from "@/components/brand/BrandMark"
import AuthIllustration from "@/components/brand/AuthIllustration"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError("Email hoặc mật khẩu không đúng")
      return
    }
    router.push("/noi-bo/lich")
    router.refresh()
  }

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-primary lg:flex-row">
      <BrandMark
        variant="white"
        className="pointer-events-none absolute -top-16 -right-24 size-[28rem] opacity-[0.06]"
      />
      <BrandMark
        variant="white"
        className="pointer-events-none absolute -bottom-24 -left-20 size-96 rotate-12 opacity-[0.06]"
      />

      {/* Brand panel — illustration only above lg; the logo/wordmark still
          show full-size on mobile just above the form, so the brand isn't
          lost when the two-column split collapses. */}
      <div className="relative z-10 hidden flex-1 flex-col items-center justify-center gap-12 px-12 py-16 lg:flex">
        <div className="flex flex-col items-center gap-3 text-center text-primary-foreground">
          <BrandMark variant="white" className="size-12" priority />
          <div>
            <p className="font-heading text-3xl font-semibold tracking-tight">Ginny House</p>
            <p className="mt-1.5 text-sm text-primary-foreground/70">
              Đăng ký góc tự học cho học sinh
            </p>
          </div>
        </div>
        <AuthIllustration />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-4 py-12">
        <div className="flex flex-col items-center gap-3 text-center text-primary-foreground lg:hidden">
          <BrandMark variant="white" className="size-10" priority />
          <div>
            <p className="font-heading text-2xl font-semibold tracking-tight">Ginny House</p>
            <p className="mt-1 text-sm text-primary-foreground/70">
              Đăng ký góc tự học cho học sinh
            </p>
          </div>
        </div>
        <div className="relative w-full max-w-sm">
          {/* Soft color glow behind the glass card — plain white-on-navy
              reads as flat/default; this gives the card something to float
              on without touching the brand palette (gold + primary only). */}
          <span className="pointer-events-none absolute -top-10 -left-10 size-40 rounded-full bg-gold/30 blur-3xl" />
          <span className="pointer-events-none absolute -right-10 -bottom-10 size-48 rounded-full bg-chart-6/25 blur-3xl" />
          <div className="relative">
            <Card className="relative overflow-hidden rounded-2xl bg-card/90 shadow-2xl shadow-black/20 ring-white/15 backdrop-blur-xl">
              <span className="absolute inset-x-0 top-0 h-1 bg-primary" />
              <CardHeader>
                <CardTitle className="text-2xl">Chào bạn quay lại</CardTitle>
                <CardDescription>Đăng nhập để quản lý lịch đăng ký góc tự học.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="ban@gmail.com"
                        className="h-11 rounded-lg pl-9"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Mật khẩu</Label>
                    <div className="relative">
                      <LockIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="h-11 rounded-lg pr-10 pl-9"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button type="submit" disabled={loading} className="h-11 w-full gap-2 rounded-lg">
                    {loading ? (
                      <>
                        <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
                        Đang đăng nhập...
                      </>
                    ) : (
                      <>
                        Đăng nhập
                        <ArrowRightIcon className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
